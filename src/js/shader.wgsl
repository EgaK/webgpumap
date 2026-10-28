struct PrimitiveVertex {
  packed_pos: u32,
  feature_id: u32,
}
struct Property {
  fillColor: vec4f,
  lineColor: vec4f,
  thickness: f32,
  index_base: u32,
  index_count: u32,
  vertex_base: u32,
}

struct Uniforms {
  u_offset: vec2f,         // 8バイト (オフセット: 0)  <- viewArray[0], [1]
  u_zoom: f32,             // 4バイト (オフセット: 8)  <- viewArray[2]
  u_flag: f32,             // 更新フラグ（必要ないけどpaddingのため配置）
  u_res_x: f32,            // 16 〜 19 バイト (canvas.width)
  u_res_y: f32,            // 20 〜 23 バイト (canvas.height)
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<storage, read> properties: array<Property>;
@group(1) @binding(1) var<storage, read> primitive_vertices: array<PrimitiveVertex>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

fn unpack_sint16x2(packed: u32) -> vec2f {
  // 下位16ビットを抽出し、左シフト後に算術右シフトで符号拡張
  let x = (i32(packed & 0xFFFFu) << 16) >> 16;
  // 上位16ビットを抽出し、右シフト（算術）で符号拡張
  let y = i32(packed) >> 16;

  return vec2f(f32(x), f32(y));
}

fn raw_to_ndc(packed_val: u32) -> vec2f {
  let decoded_pos = unpack_sint16x2(packed_val);

  // MVTは左上が原点(0,0)、WebGPUは左下が(-1,-1)なので、Y軸を反転させる
  let normalized_x = decoded_pos.x / 4096.0;
  let normalized_y = 1.0 - (decoded_pos.y / 4096.0); // 1.0 - を入れる

  return vec2f(normalized_x, normalized_y) * 2.0 - 1.0;
}

@vertex
fn vs_polygon(@builtin(vertex_index) v_idx: u32) -> VertexOutput {
    var output: VertexOutput;

    // ★ 複雑なオフセット計算は一切不要！流れてきたインデックスで直接構造体を取得
    let vertex_data = primitive_vertices[v_idx];

    // 頂点データから地物IDを取り出し、プロパティ構造体を逆引きする
    let prop = properties[vertex_data.feature_id];

    // 座標のデコード（以前直した正しいロジック）
    let raw_pos = vertex_data.packed_pos;
    let ndc_pos = raw_to_ndc(raw_pos);

    let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;

    var z = f32(vertex_data.feature_id) * 1e-6;
    output.position = vec4f(cam_pos, z, 1.0);

    // 色などもプロパティから取得
    output.color = prop.fillColor;
    return output;
}

// @vertex
// fn vs_polyline(@builtin(vertex_index) v_idx: u32) -> VertexOutput {
//   var output: VertexOutput;
//   let vertex_data = primitive_vertices[v_idx];
//   let prop = properties[vertex_data.feature_id];
//   output.color = prop.lineColor;
//   // ★JavaScript側でベースを4にしたため、4で割ることで「何番目の角頂点か」が分かります
//   let local_vert_idx = v_idx;
//
//   // 4つの角のうち、どの角（0〜3）か
//   let corner_idx = local_vert_idx % 4u;
//
//   // 4つで1セグメントなので、4で割ることで「何番目の線分セグメントか」が正確に分かります
//   let segment_idx = local_vert_idx / 4u;
//
//   // 生座標（頂点バッファ）から始点と終点を引っ張る
//   let p0 = raw_to_ndc(primitive_vertices[prop.vertex_base + segment_idx]);
//   let p1 = raw_to_ndc(primitive_vertices[prop.vertex_base + segment_idx + 1u]);
//
//   // ---- ここから下の座標変換ロジックは、corner_idx の判定方法を4つの角（0〜3）に合わせて最適化します ----
//   let cam_p0 = (p0 - uniforms.u_offset) * uniforms.u_zoom;
//   let cam_p1 = (p1 - uniforms.u_offset) * uniforms.u_zoom;
//
//   let aspect = uniforms.u_res_x / uniforms.u_res_y;
//   let dir = normalize(vec2f(cam_p1.x * aspect, cam_p1.y) - vec2f(cam_p0.x * aspect, cam_p0.y));
//   let normal = vec2f(-dir.y, dir.x);
//
//   let thickness_ndc = prop.thickness / uniforms.u_res_y;
//   let offset = vec2f((normal.x * thickness_ndc * 0.5) / aspect, normal.y * thickness_ndc * 0.5);
//
//   var final_pos = vec2f(0.0);
//
//   // ★ 4頂点（0, 1, 2, 3）の配置に合わせてオフセットを適用
//   // 0: 始点の上, 1: 始点の下, 2: 終点の下, 3: 終点の上
//   if (corner_idx == 0u)      { final_pos = cam_p0 + offset; }
//   else if (corner_idx == 1u) { final_pos = cam_p0 - offset; }
//   else if (corner_idx == 2u) { final_pos = cam_p1 - offset; }
//   else if (corner_idx == 3u) { final_pos = cam_p1 + offset; }
//
//   output.position = vec4f(final_pos, 0.0, 1.0);
//   return output;
// }

@vertex
fn vs_thinline(@builtin(vertex_index) v_idx: u32) -> VertexOutput {
  var output: VertexOutput;

  // ★ 複雑なオフセット計算は一切不要！流れてきたインデックスで直接構造体を取得
  let vertex_data = primitive_vertices[v_idx];

  // 頂点データから地物IDを取り出し、プロパティ構造体を逆引きする
  let prop = properties[vertex_data.feature_id];

  // 座標のデコード（以前直した正しいロジック）
  let raw_pos = vertex_data.packed_pos;
  let ndc_pos = raw_to_ndc(raw_pos);

  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;

  var z = f32(vertex_data.feature_id) * 1e-6 + 1e-7;
  output.position = vec4f(cam_pos, z, 1.0);

  // 色などもプロパティから取得
  output.color = prop.lineColor;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
