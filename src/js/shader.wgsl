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
  fillColor: vec4f,
  lineColor: vec4f,
  thickness: f32,
  // index_base: u32,  // これから下は使ってないので削除予定
  // index_count: u32,
  // vertex_base: u32,
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

@vertex
fn vs_polygon(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = properties[input.feature_id]; // 直接アクセスできる
  let ndc_pos = raw_to_ndc(input.packed_pos); // 直接アクセスできる

  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;

  var z = f32(input.feature_id + 1u) * 1e-6;
  output.position = vec4f(cam_pos, z, 1.0);

  // 色などもプロパティから取得
  output.color = prop.fillColor;
  return output;
}

@vertex
fn vs_thinline(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = properties[input.feature_id]; // 直接アクセスできる
  let ndc_pos = raw_to_ndc(input.packed_pos); // 直接アクセスできる
  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;
  var z = f32(input.feature_id + 1u) * 1e-6 + 1e-7;
  output.position = vec4f(cam_pos, z, 1.0);

  // 色などもプロパティから取得
  output.color = prop.lineColor;
  return output;
}

@vertex
fn vs_polyline(
  input: PolylineVertex,
) -> VertexOutput {
  var output: VertexOutput;
  let ndc_pos = raw_to_ndc(input.packed_pos); // 直接アクセスできる
  let prop = properties[input.feature_id];
  let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;

  let aspect = uniforms.u_res_x / uniforms.u_res_y;
  let normal = normalize(vec2f(input.normal.x * aspect , input.normal.y));

  // 画面の縦解像度(u_res_x)を基準に、指定ピクセル幅（prop.thickness）の半分だけオフセット
  let thickness_ndc = prop.thickness / uniforms.u_res_x;
  let offset = vec2f(
    normal.x * thickness_ndc * 0.5 / aspect,
    normal.y * thickness_ndc * 0.5
  );

  // 6. 最終的な頂点座標（カメラ座標 ＋ 太らせたオフセット）
  let final_pos = cam_pos + offset;

  var z = f32(input.feature_id + 1u) * 1e-6;
  output.position = vec4f(final_pos, z, 1.0);
  output.color = prop.lineColor;
  return output;
}


// @vertex
// fn vs_polyline1(
//   input: PolylineVertex,
//   @builtin(vertex_index) v_idx: u32 // インデックスバッファの数字が1つずつ入る
// ) -> VertexOutput {
//   var output: VertexOutput;
//
//   // 1. 地物IDからプロパティ（色や太さ）を取得
//   let prop = properties[input.feature_id];
//   output.color = prop.lineColor; // 縁取りではなく独立したラインなのでlineColorを使用
//   // output.color = vec4f(0.0,0.0,0.0,1.0);
//
//   // 2. 自分が「左(-1.0)」か「右(1.0)」のどちらに広がる頂点かを判定
//   // インデックス(v_idx)が奇数なら 1.0（右）、偶数なら -1.0（左）
//   // let offset_sign = f32(v_idx % 2u) * 2.0 - 1.0;
//   let offset_sign = input.offset_sign; // -1.0（左）、1.0（右）
//
//   // 3. 元の座標をNDC空間からカメラ空間へ変換（ポリゴンと全く同じ処理）
//   let ndc_pos = raw_to_ndc(input.packed_pos);
//   let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;
//
//   // 4. アスペクト比を考慮して、スクリーン空間（ピクセル世界）での法線（直角の向き）を計算
//   let aspect = uniforms.u_res_x / uniforms.u_res_y;
//
//   // 進行方向ベクトルをアスペクト比で補正してから90度回転させて法線を作る
//   let dir = normalize(vec2f(input.line_dir.x * aspect, input.line_dir.y));
//   let normal = vec2f(-dir.y, dir.x);
//
//   // 5. カメラがどれだけズームしても「常に一定のピクセル幅」に押し広げる計算
//   // 画面の縦解像度(u_res_y)を基準に、指定ピクセル幅（prop.thickness）の半分だけオフセット
//   let thickness_ndc = prop.thickness / uniforms.u_res_y;
//   // let thickness_ndc = 30.0 / uniforms.u_res_y;
//
//   // 計算した直角方向(normal)に、太さと、左か右か(offset_sign)を掛け算し、アスペクト比を戻す
//   let offset = vec2f(
//     (normal.x * thickness_ndc * 0.5) / aspect,
//     normal.y * thickness_ndc * 0.5
//   ) * offset_sign;
//
//   // 6. 最終的な頂点座標（カメラ座標 ＋ 太らせたオフセット）
//   let final_pos = cam_pos + offset;
//
//   // 7. 成功したポリゴンと同じ、1つ目(ID=0)が消えない安全なReversed-Z（重なり順）の計算
//   let z_val = f32(input.feature_id + 1u) * 1e-6;
//
//   output.position = vec4f(final_pos, z_val, 1.0);
//   // output.position = vec4f(cam_pos, 0.5, 1.0);
//
//   return output;
// }


@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
