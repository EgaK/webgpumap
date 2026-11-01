struct PrimitiveVertex {
  @location(0) packed_pos: u32,
  @location(1) feature_id: u32,
}
struct PolylineVertex {
  @location(0) packed_pos: u32,
  @location(1) feature_id: u32,
  @location(2) normal: vec2f,
  // @location(3) offset_sign: f32, // ★新設：0.0（左）または 1.0（右）
}
struct Property {
  fillColor: vec3f,
  opacity: f32,
  lineColor: vec3f,
  thickness: f32,
  // index_base: u32,  // これから下は使ってないので削除予定
  // index_count: u32,
  // vertex_base: u32,
}

struct Style {
  min_zoom: f32,
  min_val: f32,
  max_zoom: f32,
  max_val: f32,
};

struct Uniforms {
    u_mvp_matrix: mat4x4<f32>,   // 64バイト (0〜63)
    u_offset: vec2<f32>,         // 8バイト (64〜71)
    u_zoom: f32,                 // 4バイト (72〜75)
    u_scale: f32,                // 4バイト (76〜79)
    u_res_x: f32,                // 4バイト (80〜83)
    u_res_y: f32,                // 4バイト (84〜87)
    u_tile_z: u32,               // 4バイト (88〜91)
    u_tile_x: u32,               // 4バイト (92〜95)
    u_tile_y: u32,               // 4バイト (96〜99)
    u_tile_extent: f32,          // 4バイト (100〜103)  現在は4096の固定値だけど念のため
    // ズームイン・アウトでタイルが切り替わる際、新しいタイルが「パッ」と突然現れるとチカチカして見栄えが悪くなります。多くの地図アプリは、新しいタイルを 0.2 秒ほどかけてフワッとフェードインさせています。そのための変数u_tile_opacity
    u_tile_opacity: f32,         // 4バイト (104〜107)

    // --- パディングで256バイトのキリの良い位置（128バイト目など）に調整 ---
    pad0: f32, pad1: f32, pad2: f32, pad3: f32, pad4: f32,

    // --- スタイル配列（128バイト目からスタート） ---
    styles: array<Style, 8>, // 128バイト (128〜255)
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@group(1) @binding(0) var<storage, read> properties: array<Property>;
// @group(1) @binding(1) var<storage, read> primitive_vertices: array<PrimitiveVertex>;

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

fn sheer(color:vec3f, o: f32) -> vec4f {
  var opacity = o;
  if　(opacity<0)　{
    let style = uniforms.styles[u32(-opacity-1)];
    let t = clamp((uniforms.u_zoom - style.min_zoom) / (style.max_zoom - style.min_zoom), 0.0, 1.0);
    opacity = mix(style.min_val, style.max_val, t);
  }
  return vec4f(color, opacity);
}

@vertex
fn vs_polygon(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = properties[input.feature_id]; // 直接アクセスできる
  let ndc_pos = raw_to_ndc(input.packed_pos); // 直接アクセスできる

  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_scale;

  var z = f32(input.feature_id + 1u) * 1e-6;
  output.position = vec4f(cam_pos, z, 1.0);

  // 色などもプロパティから取得
  output.color = sheer(prop.fillColor, prop.opacity);
  return output;
}

@vertex
fn vs_thinline(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = properties[input.feature_id]; // 直接アクセスできる
  let ndc_pos = raw_to_ndc(input.packed_pos); // 直接アクセスできる
  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_scale;
  var z = f32(input.feature_id + 1u) * 1e-6 + 1e-7;
  output.position = vec4f(cam_pos, z, 1.0);

  // 色などもプロパティから取得
  output.color = sheer(prop.lineColor, prop.opacity);
  return output;
}

@vertex
fn vs_polyline(
  input: PolylineVertex,
) -> VertexOutput {
  var output: VertexOutput;
  let ndc_pos = raw_to_ndc(input.packed_pos); // 直接アクセスできる
  let prop = properties[input.feature_id];
  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_scale;

  var thickness = prop.thickness;
  if　(thickness<0)　{
    let style = uniforms.styles[u32(-thickness-1)];
    let t = clamp((uniforms.u_zoom - style.min_zoom) / (style.max_zoom - style.min_zoom), 0.0, 1.0);
    thickness = mix(style.min_val, style.max_val, t);
  }

  let aspect = uniforms.u_res_x / uniforms.u_res_y;
  let normal = normalize(vec2f(input.normal.x * aspect , input.normal.y));

  // 画面の縦解像度(u_res_x)を基準に、指定ピクセル幅（prop.thickness）の半分だけオフセット
  let thickness_ndc = thickness / uniforms.u_res_x;
  let offset = vec2f(
    normal.x * thickness_ndc * 0.5 / aspect,
    normal.y * thickness_ndc * 0.5
  );

  // 6. 最終的な頂点座標（カメラ座標 ＋ 太らせたオフセット）
  let final_pos = cam_pos + offset;

  var z = f32(input.feature_id + 1u) * 1e-6;
  output.position = vec4f(final_pos, z, 1.0);
  output.color = sheer(prop.lineColor, prop.opacity);
  // output.color = vec4f(prop.lineColor, 0.5);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
