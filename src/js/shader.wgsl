struct PrimitiveVertex {
  @location(0) pos: vec2i,
  @location(1) style_id: i32,
}
struct PolylineVertex {
  @location(0) pos: vec2i,
  @location(1) style_id: i32,
  @location(2) pad: i32,
  @location(3) normal: vec2f,
}

struct Style {
  fillColor: vec3f,
  opacity: f32,
  lineColor: vec3f,
  thickness: f32,
}

struct ClampTable {
  min_zoom: f32,
  min_val: f32,
  max_zoom: f32,
  max_val: f32,
};

struct Uniforms {
  zoom: f32,
  // ズームイン・アウトでタイルが切り替わる際、新しいタイルが「パッ」と突然現れるとチカチカして見栄えが悪くなります。多くの地図アプリは、新しいタイルを 0.2 秒ほどかけてフワッとフェードインさせています。そのための変数tile_opacity
  tile_opacity: f32,

  pad0: f32, pad1: f32,
  clamps: array<ClampTable, 6>, // 16バイト目から96バイト
  padvec1: vec4f,
  styles: array<Style, 12>  // 128バイト目から
}

struct Transform {
  matrix: mat3x2f, // 24バイト (3列 × vec2f)
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<uniform> transform: Transform;
@group(1) @binding(1) var<storage, read> styles: array<Style>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec2f,
  @location(2) pos: vec2f,
}

fn sheer(color:vec3f, o: f32) -> vec4f {
  var opacity = o;
  if　(opacity<0)　{
    let style = uniforms.clamps[u32(-opacity-1)];
    let t = clamp((uniforms.zoom - style.min_zoom) / (style.max_zoom - style.min_zoom), 0.0, 1.0);
    opacity = mix(style.min_val, style.max_val, t);
  }
  return vec4f(color, opacity);
}

@vertex
fn vs_polygon(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = uniforms.styles[input.style_id];
  let cam_pos = transform.matrix*vec3f(vec2f(input.pos), 1.0);

  var z = f32(input.style_id + 1) * 1e-6;
  output.position = vec4f(cam_pos, z, 1.0);
  output.color = sheer(prop.fillColor, prop.opacity);
  return output;
}

@vertex
fn vs_thinline(input:PrimitiveVertex) -> VertexOutput {
  var output: VertexOutput;
  let prop = uniforms.styles[input.style_id];
  let cam_pos = transform.matrix*vec3f(vec2f(input.pos), 1.0);
  var z = f32(input.style_id + 1) * 1e-6 + 1e-7;
  output.position = vec4f(cam_pos, z, 1.0);
  output.color = sheer(prop.lineColor, prop.opacity);
  return output;
}

@vertex
fn vs_polyline(
  input: PolylineVertex,
) -> VertexOutput {
  var output: VertexOutput;
  let prop = uniforms.styles[input.style_id];
  let cam_pos = transform.matrix*vec3f(vec2f(input.pos), 1.0);

  var thickness = prop.thickness;
  if(thickness==-5){ // これは線路を決め打ちで番号振ってるので、IDが変わったりしたら変更する
    output.pos = vec2f(input.pos);
  } else {
    output.pos = vec2f(0,0);
  }
  if　(thickness<0)　{
    let style = uniforms.clamps[u32(-thickness-1)];
    let t = clamp((uniforms.zoom - style.min_zoom) / (style.max_zoom - style.min_zoom), 0.0, 1.0);
    thickness = mix(style.min_val, style.max_val, t);
  }

  let normal = normalize(input.normal);

  // 画面の縦解像度(w)を基準に、指定ピクセル幅（prop.thickness）の半分だけオフセット
  let thickness_ndc = thickness / 512.0;
  let offset = vec2f(
    normal.x * thickness_ndc * 0.5,
    normal.y * thickness_ndc * 0.5
  );

  // 6. 最終的な頂点座標（カメラ座標 ＋ 太らせたオフセット）
  let final_pos = cam_pos + offset;

  var z = f32(input.style_id + 1) * 1e-6;
  output.position = vec4f(final_pos, z, 1.0);
  output.color = sheer(prop.lineColor, prop.opacity);
  output.normal = normal;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}

@fragment
fn fs_polyline(input: VertexOutput) -> @location(0) vec4f {
  if(length(input.normal) < 0.5 && length(input.pos)>0 && ((input.pos.y + 1) /30) % 2 > 0.5){
    discard;
  }
  return input.color;
}

// @vertex
// fn vs_mask(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
//     var out: VertexOutput;
//
//     // 頂点インデックス（0〜3）に応じて、MVTのローカル座標（0〜4096）を動的に生成
//     // Triangle Strip 用の配置 (左下、右下、左上、右上)
//     var local_pos = vec2<f32>(0.0, 0.0);
//     if (vertexIndex == 1u) { local_pos = vec2<f32>(4096.0, 0.0); }
//     if (vertexIndex == 2u) { local_pos = vec2<f32>(0.0, 4096.0); }
//     if (vertexIndex == 3u) { local_pos = vec2<f32>(4096.0, 4096.0); }
//
//     // タイルの位置に合わせて座標変換
//     out.position = vec4f(transform.matrix * vec3<f32>(local_pos, 1.0), 1.0, 1.0);
//     return out;
// }
//
// @fragment
// fn fs_dummy() -> @location(0) vec4<f32> {
//     return vec4<f32>(0.0); // パイプライン側で writeMask: 0 にしているので、何を出力しても画面には塗られません
// }
