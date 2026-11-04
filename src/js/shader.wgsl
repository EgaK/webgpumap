struct PrimitiveVertex {
  @location(0) pos: vec2i,
  @location(1) feature_id: i32,
}
struct PolylineVertex {
  @location(0) pos: vec2i,
  @location(1) feature_id: i32,
  @location(2) pad: u32,
  @location(3) normal: vec2f,
}
struct Property {
  fillColor: vec3f,
  opacity: f32,
  lineColor: vec3f,
  thickness: f32,
}

struct Style {
  min_zoom: f32,
  min_val: f32,
  max_zoom: f32,
  max_val: f32,
};

// struct Uniforms2 {
//     u_mvp_matrix: mat4x4<f32>,   // 64バイト (0〜63)
//     u_offset: vec2<f32>,         // 8バイト (64〜71)
//     u_zoom: f32,                 // 4バイト (72〜75)
//     u_scale: f32,                // 4バイト (76〜79)
//     w: f32,                // 4バイト (80〜83)
//     h: f32,                // 4バイト (84〜87)
//     u_tile_z: u32,               // 4バイト (88〜91)
//     u_tile_x: u32,               // 4バイト (92〜95)
//     u_tile_y: u32,               // 4バイト (96〜99)
//     u_tile_extent: f32,          // 4バイト (100〜103)  現在は4096の固定値だけど念のため
//     // ズームイン・アウトでタイルが切り替わる際、新しいタイルが「パッ」と突然現れるとチカチカして見栄えが悪くなります。多くの地図アプリは、新しいタイルを 0.2 秒ほどかけてフワッとフェードインさせています。そのための変数u_tile_opacity
//     u_tile_opacity: f32,         // 4バイト (104〜107)
//
//     // --- パディングで256バイトのキリの良い位置（128バイト目など）に調整 ---
//     pad0: f32, pad1: f32, pad2: f32, pad3: f32, pad4: f32,
//
//     // --- スタイル配列（128バイト目からスタート） ---
//     styles: array<Style, 8>, // 128バイト (128〜255)
// };

struct Uniforms {
  matrix: mat3x2f, // 24バイト (3列 × vec2f)
  pad0: f32, pad1: f32,
  styles: array<Style, 6>, // 96バイト (32〜128)
}

struct Transform {
  matrix: mat3x2f, // 24バイト (3列 × vec2f)
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<uniform> transform: Transform;
@group(1) @binding(1) var<storage, read> properties: array<Property>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec2f,
  @location(2) pos: vec2f,
}

// fn raw_to_ndc(pos: vec2i) -> vec2f {
//   let normalized_x = f32(pos.x) / (8 * uniforms.w);
//   let normalized_y = 1.0 - (f32(pos.y) / (8 * uniforms.h)); // 1.0 - を入れる
//   return vec2f(normalized_x, normalized_y) * 2.0 - 1.0;
// }

// fn sheer(color:vec3f, o: f32) -> vec4f {
//   var opacity = o;
//   if　(opacity<0)　{
//     let style = uniforms.styles[u32(-opacity-1)];
//     let t = clamp((uniforms.u_zoom - style.min_zoom) / (style.max_zoom - style.min_zoom), 0.0, 1.0);
//     opacity = mix(style.min_val, style.max_val, t);
//   }
//   return vec4f(color, opacity);
// }

@vertex
fn vs_polygon(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = properties[input.feature_id];
  let cam_pos = transform.matrix*vec3f(vec2f(input.pos), 1.0);

  var z = f32(input.feature_id + 1) * 1e-6;
  output.position = vec4f(cam_pos, z, 1.0);
  // output.color = sheer(prop.fillColor, prop.opacity);
  output.color = vec4f(prop.fillColor, 1.0);
  return output;
}

// @vertex
// fn vs_thinline(input:PrimitiveVertex) -> VertexOutput {
//   var output: VertexOutput;
//   let prop = properties[input.feature_id];
//   let cam_pos = uniforms.matrix(input.pos, 1.0);
//   var z = f32(input.feature_id + 1) * 1e-6 + 1e-7;
//   output.position = vec4f(cam_pos, z, 1.0);
//   // output.color = sheer(prop.lineColor, prop.opacity);
//   output.color = sheer(prop.lineColor, 1.0);
//   return output;
// }

// @vertex
// fn vs_polyline(
//   input: PolylineVertex,
// ) -> VertexOutput {
//   var output: VertexOutput;
//   let ndc_pos = uniforms.matrix(input.pos, 1.0);
//   let prop = properties[input.feature_id];
//   let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_scale;
//
//   var thickness = prop.thickness;
//   if(thickness==-1){
//     output.pos = cam_pos;
//   } else {
//     output.pos = vec2f(0,0);
//   }
//   if　(thickness<0)　{
//     let style = uniforms.styles[u32(-thickness-1)];
//     let t = clamp((uniforms.u_zoom - style.min_zoom) / (style.max_zoom - style.min_zoom), 0.0, 1.0);
//     thickness = mix(style.min_val, style.max_val, t);
//   }
//
//   let aspect = uniforms.w / uniforms.h;
//   let normal = normalize(vec2f(input.normal.x * aspect , input.normal.y));
//
//   // 画面の縦解像度(w)を基準に、指定ピクセル幅（prop.thickness）の半分だけオフセット
//   let thickness_ndc = thickness / uniforms.w;
//   let offset = vec2f(
//     normal.x * thickness_ndc * 0.5 / aspect,
//     normal.y * thickness_ndc * 0.5
//   );
//
//   // 6. 最終的な頂点座標（カメラ座標 ＋ 太らせたオフセット）
//   let final_pos = cam_pos + offset;
//
//   var z = f32(input.feature_id + 1) * 1e-6;
//   output.position = vec4f(final_pos, z, 1.0);
//   output.color = sheer(prop.lineColor, prop.opacity);
//   output.normal = normal;
//   return output;
// }

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}

@fragment
fn fs_polyline(input: VertexOutput) -> @location(0) vec4f {
  if(length(input.pos)>0 && length(input.normal) < 0.5 && ((input.pos.y + 1) * 20) % 2 > 0.5){
    discard;
  }
  return input.color;
}
