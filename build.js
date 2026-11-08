const fs = require("fs");
const { execFile, exec } = require("child_process");
const esbuild = require("esbuild");
const { glsl } = require("esbuild-plugin-glsl");
const htmlMinifier = require("html-minifier").minify;
const sass = require("sass");
const { log } = require("console");

const path = process.argv[2];
const projDir = process.argv[3];
const cat = path.replace(projDir + "/src", "").split("/")[1];
const fileName = path.substring(path.lastIndexOf("/") + 1);
const isProd = process.argv.includes("--prod");

try {
  switch (cat) {
    case "workers":
      copyWorkers(path);
      break;
    case "js":
      jsBuild(path);
      break;
    case "html":
      copyHtml();
      break;
    case "css":
      cssBuild();
      break;
    default:
      log("何もしなかったよ:", path);
      break;
  }
} catch (e) {
  log(e);
}

async function jsBuild() {
  // console.log(JSON.stringify(compilerPackage));
  // return;
  const startT = Date.now();

  function runClosure(args) {
    return new Promise((resolve, reject) => {
      exec(
        `google-closure-compiler ${args.join(" ")}`,
        { maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          if (error) reject(stderr);
          else resolve({ stdout, stderr });
        },
      );
    });
  }

  if (false) {
    await esbuild.build({
      entryPoints: {
        "worker": "src/js/worker.js",
      },
      bundle: true,
      outdir: "dist/statics",
      format: "esm",
      target: "es2020",
      define: {
        "DEVELOP": "true",
        "WORKERCODE": "0",
      },
      plugins: [
        glsl({
          minify: true, // ★ WGSL/GLSLファイルをインポート時に自動でMinifyする
        }),
      ],
    });

    // あえてworkerとindexを別にコンパイルしてプロパティ名圧縮で対策してないと問題がおきるようにしてる
    await runClosure([
      "--compilation_level",
      "ADVANCED_OPTIMIZATIONS",
      "--language_in",
      "ECMASCRIPT_2020",
      "--language_out",
      "ECMASCRIPT_2020",
      "--js",
      "dist/statics/worker.js",
      "--js_output_file",
      "dist/statics/worker.min.js",
      "--create_source_map",
      "dist/statics/worker.map",
      "--source_map_location_mapping",
      "'dist/statics/|/'",
      "--output_wrapper",
      "'%output%//# sourceMappingURL=/worker.map'",
      "--externs",
      "closure-externs.js",
      "--warning_level",
      "QUIET",
    ]);

    const minifiedWorkerCode = fs.readFileSync(
      "dist/statics/worker.min.js",
      "utf8",
    );

    await esbuild.build({
      entryPoints: {
        "index": "src/js/index.js",
      },
      bundle: true,
      outdir: "dist/statics",
      format: "esm",
      target: "es2020",
      define: {
        "DEVELOP": "true",
        "WORKER_CODE": JSON.stringify(minifiedWorkerCode),
      },
      plugins: [
        glsl({
          minify: true, // ★ WGSL/GLSLファイルをインポート時に自動でMinifyする
        }),
      ],
    });

    await runClosure([
      "--compilation_level",
      "ADVANCED_OPTIMIZATIONS",
      "--language_in",
      "ECMASCRIPT_2020",
      "--language_out",
      "ECMASCRIPT_2020",
      "--js",
      "dist/statics/index.js",
      "--js_output_file",
      "dist/statics/index.min.js",
      "--create_source_map",
      "dist/statics/index.map",
      "--source_map_location_mapping",
      "'dist/statics/|/'",
      "--output_wrapper",
      "'%output%//# sourceMappingURL=/index.map'",
      "--externs",
      "closure-externs.js",
      "--warning_level",
      "QUIET",
    ]);

    log(`\u001b[35mbuild Javascript\u001b[0m ${Date.now() - startT}ms`);
  } else {
    // ==========================================
    // 🚀 本番モード（2ステップ・ビルド）
    // ==========================================

    await esbuild.build({
      entryPoints: {
        "worker": "src/js/worker.js",
      },
      bundle: true,
      outdir: "dist/statics",
      format: "esm",
      target: "es2020",
      define: {
        "DEVELOP": "true",
        "WORKERCODE": "0",
      },
      plugins: [
        glsl({
          minify: true, // ★ WGSL/GLSLファイルをインポート時に自動でMinifyする
        }),
      ],
    });

    // あえてworkerとindexを別にコンパイルしてプロパティ名圧縮で対策してないと問題がおきるようにしてる
    await runClosure([
      "--compilation_level",
      "ADVANCED_OPTIMIZATIONS",
      "--language_in",
      "ECMASCRIPT_2020",
      "--language_out",
      "ECMASCRIPT_2020",
      "--js",
      "dist/statics/worker.js",
      "--js_output_file",
      "dist/statics/worker.min.js",
      "--create_source_map",
      "dist/statics/worker.map",
      "--source_map_location_mapping",
      "'dist/statics/|/'",
      "--output_wrapper",
      "'%output%//# sourceMappingURL=/worker.map'",
      "--externs",
      "closure-externs.js",
      "--warning_level",
      "QUIET",
    ]);

    const minifiedWorkerCode = fs.readFileSync(
      "dist/statics/worker.js",
      "utf8",
    );

    await esbuild.build({
      entryPoints: {
        "index": "src/js/index.js",
      },
      bundle: true,
      outdir: "dist/statics",
      format: "esm",
      target: "es2020",
      define: {
        "DEVELOP": "true",
        "WORKER_CODE": JSON.stringify(minifiedWorkerCode),
      },
      plugins: [
        glsl({
          minify: true, // ★ WGSL/GLSLファイルをインポート時に自動でMinifyする
        }),
      ],
    });

    await runClosure([
      "--compilation_level",
      "ADVANCED_OPTIMIZATIONS",
      "--language_in",
      "ECMASCRIPT_2020",
      "--language_out",
      "ECMASCRIPT_2020",
      "--js",
      "dist/statics/index.js",
      "--js_output_file",
      "dist/statics/index.min.js",
      "--create_source_map",
      "dist/statics/index.map",
      "--source_map_location_mapping",
      "'dist/statics/|/'",
      "--output_wrapper",
      "'%output%//# sourceMappingURL=/index.map'",
      "--externs",
      "closure-externs.js",
      "--warning_level",
      "QUIET",
    ]);

    // 一時ファイルのクリーンアップ
    // fs.rmSync("dist/tmp", { recursive: true, force: true });

    log(`\u001b[35mbuild Javascript\u001b[0m ${Date.now() - startT}ms`);
  }
}

function copyHtml() {
  var cmds = `
    cp ${path} tmp/
  `;

  exec(cmds, (error, stdout, stderr) => {
    // エラー出力
    if (error) log(`\u001b[35merror:\u001b[0m ${error}`);
    // 標準出力
    if (stdout)
      log(`\u001b[35mstdout:\u001b[0m ${stdout} ${Date.now() - startT}ms`);
    // 標準エラー出力
    if (stderr) log(`\u001b[35mstderr:\u001b[0m ${stderr}`);
    htmlCompose();
  });
}

function copyWorkers(path) {
  const data = fs.readFileSync(path, "utf8");
  const dest = path.replace("src/", "dist/");
  const dir = dest.substring(0, dest.lastIndexOf("/"));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dest, data, "utf8");
  log(
    "\u001b[35mworkers file copied:\u001b[0m",
    path.replace(/.*workers\//, ""),
  );
}

function cssBuild() {
  const startT = Date.now();
  const files = ["index"]; //["b", "e", "a"];
  for (var f of files) {
    const css = sass.compile(`${projDir}/src/css/${f}.scss`, {
      style: "compressed",
    });
    fs.writeFileSync(`${projDir}/tmp/${f}.css`, css.css, "utf8");
  }

  log(`\u001b[35mCSS files compiled ${Date.now() - startT}ms\u001b[0m`);
  htmlCompose();
}

function htmlCompose() {
  const files = ["index"];
  for (const file of files) {
    const css = fs.readFileSync(`tmp/${file}.css`, "utf8");
    const html = fs
      .readFileSync(`tmp/${file}.html`, "utf8")
      .replace(
        /<style>.*<\/style>/m,
        `<meta content=${new Date().toISOString()} name=revised /><style>${css}</style>`,
      );

    const minified = htmlMinifier(html, {
      removeAttributeQuotes: true,
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      collapseInlineTagWhitespace: true,
      decodeEntities: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeTagWhitespace: true,
      sortAttributes: true,
      // minifyJS: true,
      // minifyCSS: true,
      maxLineLength: 500,
    });
    fs.writeFileSync(
      projDir + `/dist/workers/template/${file}.html`,
      minified,
      "utf8",
    );
  }
  log(`\u001b[35mhtml files composed\u001b[0m`);
}

function minifyHtml(path) {
  const html = fs.readFileSync(path, "utf8");
  const minified = htmlMinifier(html, {
    removeAttributeQuotes: true,
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    decodeEntities: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeTagWhitespace: true,
    sortAttributes: true,
    minifyJS: true,
    minifyCSS: true,
    maxLineLength: 500,
  });
  fs.writeFileSync(
    projDir + "/dist/workers/templates/" + fileName,
    minified,
    "utf8",
  );
  log(`\u001b[35m${fileName} file composed\u001b[0m`);
}
