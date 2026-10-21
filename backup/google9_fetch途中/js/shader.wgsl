struct DrawCommand {
    color: vec4f,       // 0〜15バイト
    thickness: f32,     // 16〜19バイト
    index_base: u32,    // 20〜23バイト
    index_count: u32,   // 24〜27バイト
    fig_type: u32,      // 28〜31バイト　// 0: Polygon, 1: Polyline, 2: Round Join
    vertex_base: u32,   // 32〜35バイト
    // パディングなくても自動で48バイトに切り上げされる
    // _pad1: u32,          // 16バイトアライメント
    // _pad2: u32,
}

struct Uniforms {
    u_resolution: vec2f,
    u_zoom: f32,
    u_coordinate_max: f32, // ★ 追加: JS側から「4096.0」を渡す（アライメント調整用パディング兼務）
    u_offset: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
// ★ vec2f から vec2u (または vec2i) に変更
@group(0) @binding(1) var<storage, read> all_vertices: array<u32>;
@group(0) @binding(2) var<storage, read> all_indices: array<u32>;
@group(0) @binding(3) var<storage, read> commands: array<DrawCommand>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

// --- 修正箇所②: u32のパッキングデータから、符号(マイナス)を維持してvec2fに復元する関数 ---
fn unpack_sint16x2(packed: u32) -> vec2f {
  // 下位16ビット(X)と上位16ビット(Y)を切り出す
  let raw_x = packed & 0xFFFFu;
  let raw_y = (packed >> 16u) & 0xFFFFu;

  // 16ビットの数値を32ビットの符号付き整数(i32)に直す（符号拡張）
  // 左に16シフトして右に16シフトすることで、マイナスのビットを正しく引き延ばします
  let x = (i32(raw_x) << 16) >> 16;
  let y = (i32(raw_y) << 16) >> 16;

  return vec2f(f32(x), f32(y));
}

// ★ 整数座標(0〜4096)を、WebGPUの標準空間(-1.0〜1.0)の浮動小数点に変換するヘルパー関数
// --- 修正箇所③: raw_to_ndc を上記を呼び出す形に変更 ---
fn raw_to_ndc(packed_val: u32) -> vec2f {
  // 結合されたu32から、正しいマイナス対応のf32座標を取り出す
  let decoded_pos = unpack_sint16x2(packed_val);

  // 0〜4096基準の座標を -1.0〜1.0 に変換
  let normalized = decoded_pos / uniforms.u_coordinate_max;
  return normalized * 2.0 - 1.0;
}

@vertex
fn vs_main(
  @builtin(vertex_index) v_idx: u32,
  @builtin(instance_index) inst_idx: u32
) -> VertexOutput {
  var output: VertexOutput;
  let cmd = commands[inst_idx];
  output.color = cmd.color;

  // ------------------------------------------
  // パターン0: ポリゴン
  // ------------------------------------------
  if (cmd.fig_type == 0u) {
    if (v_idx >= cmd.index_count) {
      output.position = vec4f(0.0, 0.0, 0.0, 0.0);
      return output;
    }
    let global_idx = cmd.index_base + v_idx;
    let local_vert_idx = all_indices[global_idx];

    // ★ 整数座標を読み出し、浮動小数点の NDC(-1〜1) 座標に変換
    let raw_pos = all_vertices[cmd.vertex_base + local_vert_idx];
    let ndc_pos = raw_to_ndc(raw_pos);

    // カメラ変換を適用（ここからは元のロジックと同じ）
    let cam_pos = (ndc_pos - uniforms.u_offset) * uniforms.u_zoom;
    output.position = vec4f(cam_pos, 0.0, 1.0);
    return output;
  }

  // ------------------------------------------
  // パターン1: 太い折れ線（ズーム不変幅版）
  // ------------------------------------------
  if (cmd.fig_type == 1u) {
    let segment_idx = v_idx / 6u;
    let corner_idx = v_idx % 6u;

    if (segment_idx >= cmd.index_count - 1u) {
      output.position = vec4f(0.0, 0.0, 0.0, 0.0);
      return output;
    }

    // ★ 整数座標を読み出し、NDC座標に変換
    let p0 = raw_to_ndc(all_vertices[cmd.vertex_base + segment_idx]);
    let p1 = raw_to_ndc(all_vertices[cmd.vertex_base + segment_idx + 1u]);

    let cam_p0 = (p0 - uniforms.u_offset) * uniforms.u_zoom;
    let cam_p1 = (p1 - uniforms.u_offset) * uniforms.u_zoom;

    let aspect = uniforms.u_resolution.x / uniforms.u_resolution.y;
    let dir = normalize(vec2f(cam_p1.x * aspect, cam_p1.y) - vec2f(cam_p0.x * aspect, cam_p0.y));
    let normal = vec2f(-dir.y, dir.x);

    let thickness_ndc = cmd.thickness / uniforms.u_resolution.y;
    let offset = vec2f((normal.x * thickness_ndc * 0.5) / aspect, normal.y * thickness_ndc * 0.5);

    var final_pos = vec2f(0.0);
    if (corner_idx == 0u) { final_pos = cam_p0 + offset; }
    else if (corner_idx == 1u || corner_idx == 4u) { final_pos = cam_p0 - offset; }
    else if (corner_idx == 2u || corner_idx == 3u) { final_pos = cam_p1 + offset; }
    else if (corner_idx == 5u) { final_pos = cam_p1 - offset; }

    output.position = vec4f(final_pos, 0.0, 1.0);
    return output;
  }

  // ------------------------------------------
  // パターン2: 関節の Round Join（ズーム不変幅版）
  // ------------------------------------------
  if (cmd.fig_type == 2u) {
  // output.color = vec4f(1.0, 0.0, 0.0, 1.0); // ★強制的に真っ赤にする
      let total_circle_vertices = cmd.index_count * 3u;
      if (v_idx >= total_circle_vertices) {
          output.position = vec4f(0.0, 0.0, 0.0, 0.0);
          return output;
      }

      let tri_idx = v_idx / 3u;
      let sub_idx = v_idx % 3u;

      // ★ 整数座標を読み出し、NDC座標に変換
      let center_pos = raw_to_ndc(all_vertices[cmd.vertex_base + cmd.index_base]);

      let cam_center = (center_pos - uniforms.u_offset) * uniforms.u_zoom;
      var final_pos = cam_center;

      if (sub_idx > 0u) {
          var vertex_on_ring = tri_idx;
          if (sub_idx == 2u) {
              vertex_on_ring = (tri_idx + 1u) % cmd.index_count;
          }

          let angle = (f32(vertex_on_ring) / f32(cmd.index_count)) * 2.0 * 3.14159265;
          let raw_offset = vec2f(cos(angle), sin(angle));

          let aspect = uniforms.u_resolution.x / uniforms.u_resolution.y;
          let radius_ndc = (cmd.thickness * 0.5) / uniforms.u_resolution.y;

          let offset = vec2f((raw_offset.x * radius_ndc) / aspect, raw_offset.y * radius_ndc);
          final_pos = cam_center + offset;
      }

      output.position = vec4f(final_pos, 0.0, 1.0);
      return output;
  }
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
