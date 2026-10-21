const fs = require("fs");
const { exec } = require("child_process");
const esbuild = require("esbuild");
const { glsl } = require("esbuild-plugin-glsl");
const htmlMinifier = require("html-minifier").minify;
const sass = require("sass");
const { log } = require("console");

const path = process.argv[2];
const projDir = process.argv[3];
const cat = path.replace(projDir + "/src", "").split("/")[1];
const fileName = path.substring(path.lastIndexOf("/") + 1);

const jsfile = "edit.js";
// user.js,
// edit.js',
// admin.js',

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

function jsBuild(path) {
  const startT = Date.now();
  esbuild.build({
    entryPoints: [projDir + "/src/js/index.js", projDir + "/src/js/worker.js"],
    outdir: projDir + "/dist/statics/",
    platform: "browser",
    bundle: true,
    // splitting: true,
    format: "esm",
    // chunkNames: "common-[hash]",
    plugins: [
      {
        name: "example",
        setup(build) {
          build.onLoad({ filter: /\.js?/ }, async (args) => {
            let text = await fs.promises.readFile(args.path, "utf8");
            return {
              contents: text.replace(/DEBUG/g, true),
              loader: "jsx",
            };
          });
        },
      },
      glsl({
        minify: true, // ★ WGSL/GLSLファイルをインポート時に自動でMinifyする
      }),
    ],
    // minify: true,
    loader: {
      ".js": "jsx",
      ".wgsl": "text",
    },
    jsxFactory: "h",
    jsxFragment: "Fragment",
    // drop: process.argv[3] == "false" ? ["console", "debugger"] : [],
  });

  var cmds = `
      cd dist/statics
      google-closure-compiler --js index.js --js_output_file index.min.js --externs ../../closure-externs.js --warning_level QUIET --compilation_level ADVANCED --create_source_map index.map  --output_wrapper "%output%//# sourceMappingURL=/index.map"
    `;

  exec(cmds, (error, stdout, stderr) => {
    // エラー出力
    if (error) log(`\u001b[35merror:\u001b[0m ${error}`);
    // 標準出力
    if (stdout)
      log(`\u001b[35mstdout:\u001b[0m ${stdout} ${Date.now() - startT}ms`);
    // 標準エラー出力
    if (stderr) log(`\u001b[35mstderr:\u001b[0m ${stderr}`);
    log(
      `\u001b[35mClosure compiler build Javascript\u001b[0m ${Date.now() - startT}ms`,
    );
  });
  // log(`\u001b[35mbuild Javascript\u001b[0m ${Date.now() - startT}ms`);
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
      .replace(/<style>.*<\/style>/m, `<style>${css}</style>`);

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
    fs.writeFileSync(projDir + `/dist/statics/${file}.html`, minified, "utf8");
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
