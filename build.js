const fs = require("fs");
const { execFile, exec } = require("child_process");
// const compilerPackage = require("google-closure-compiler");
// // const ClosureCompiler = compilerPackage.compiler;
// const ClosureCompiler =
//   "/opt/homebrew/Cellar/closure-compiler/20261020/bin/closure-compiler";
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

  if (!isProd) {
    await esbuild.build({
      entryPoints: {
        "index": "src/js/index.js",
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
    await Promise.all([
      runClosure([
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
      ]),
      runClosure([
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
      ]),
    ]);

    log(`\u001b[35mbuild Javascript\u001b[0m ${Date.now() - startT}ms`);
  } else {
    // ==========================================
    // 🚀 本番モード（2ステップ・ビルド）
    // ==========================================

    // 1-1. WorkerのTSをesbuildでJSにバンドル
    await esbuild.build({
      entryPoints: ["src/my-worker.ts"],
      bundle: true,
      outfile: "dist/tmp/worker.raw.js",
      format: "esm",
      target: "es2022",
      define: { "DEVELOP": "0" },
    });

    // 1-2. WorkerのJSをClosure Compiler Advancedに通す
    // ★ここでメインコードと同じリネーム規則（同じ型定義・共通ルール）が適用されるようにします
    await runClosure([
      "--compilation_level",
      "ADVANCED_OPTIMIZATIONS",
      "--language_in",
      "ECMASCRIPT_2022",
      "--language_out",
      "ECMASCRIPT_2022",
      "--define",
      "DEVELOP=",
      "--js",
      "dist/tmp/worker.raw.js",
      "--js_output_file",
      "dist/tmp/worker.min.js",
    ]);

    // 1-3. 圧縮されたWorkerのコード（文字列）を読み込む
    const minifiedWorkerCode = fs.readFileSync(
      "dist/tmp/worker.min.js",
      "utf8",
    );

    console.log(
      "ステップ 2: メインコードのコンパイルとWorkerのインライン化...",
    );

    // 2-1. esbuildでメインコードをバンドル
    // この際、esbuildの `define` を使って、コード内の `WORKER_CODE` という定数を
    // 先ほど圧縮したWorkerの「文字列データ」に直接置き換えます。
    const result = await esbuild.build({
      entryPoints: {
        "base": "src/base.ts",
        "edit": "src/edit.ts",
        "admin": "src/admin.ts",
      },
      bundle: true,
      write: true,
      outdir: "dist/tmp/main",
      format: "esm",
      metafile: true,
      target: "es2022",
      define: {
        "DEVELOP": "0",
        // Workerのソースコードを文字列リテラルとして丸ごと注入
        "WORKER_CODE": JSON.stringify(minifiedWorkerCode),
      },
    });

    // 2-2. メインコードの Closure Compiler 実行（引数自動組み立て）
    const outputs = result.metafile.outputs;
    const chunkArgs = [];
    const jsFiles = [];
    const chunkConfig = {
      "base": { parent: null },
      "edit": { parent: "base" },
      "admin": { parent: "edit" },
    };

    Object.keys(chunkConfig).forEach((name) => {
      const config = chunkConfig[name];
      const actualFile = Object.keys(outputs).find((p) =>
        p.endsWith(`${name}.js`),
      );
      if (!actualFile) return;
      jsFiles.push("--js", actualFile);
      let chunkStr = `${name}:1`;
      if (config.parent) chunkStr += `:${config.parent}`;
      chunkArgs.push("--chunk", chunkStr);
    });

    // メインのClosure実行引数
    const closureArgs = [
      "--compilation_level",
      "ADVANCED_OPTIMIZATIONS",
      "--language_in",
      "ECMASCRIPT_2022",
      "--language_out",
      "ECMASCRIPT_2022",
      "--define",
      "DEVELOP=0",
      ...jsFiles,
      ...chunkArgs,
      "--chunk_output_path_prefix",
      "dist/js/",
    ];

    await runClosure(closureArgs);

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
