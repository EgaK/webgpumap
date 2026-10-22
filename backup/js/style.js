export default [
  {
    // 鉄道
    Type: "l",
    Layer: "t",
    Color: "150,150,150",
    // Color: '969696',
    Width: [
      [10, 3],
      [15, 5],
    ],
    // Border: 5,
    // Dash: [30, 30],
    // Width: [
    // 	[10, 3],
    // 	[15, 20],
    // ],
  },
  {
    // 建物
    Type: "f",
    Layer: "b",
    Color: "240,245,240",
    // Color: 'f0f5f0',
    // Color: '200,200,200',
    // Width: 1,
    Border: 1,
    // OPacity: .5,
  },

  {
    // 道路輪郭
    Type: "l",
    Layer: "r1",
    Color: "99,99,99",
    // Color: '636363',
    Width: 1,
    OPacity: [
      [16, 0],
      [18, 1],
    ],
  },
  {
    // 道路部品
    Type: "l",
    Layer: "r2",
    Color: "196,160,0",
    // Color: 'c4a000',
    Width: 1,
    OPacity: [
      [16, 0],
      [17, 1],
    ],
  },
  {
    // その他の道路
    Type: "f",
    Layer: "r5",
    Color: "255,255,255",
    // Color: 'ffffff',
  },

  {
    // 高速
    Type: "f",
    Layer: "r3",
    Color: "255,197,153",
    // Color: 'ffc599',
  },
  {
    // 高速 // Zoom13以下のとき
    Type: "l",
    Layer: "r8",
    Color: "255,197,153",
    // Color: 'ffc599',
    // Border: 1,
    // OPacity: [
    // 	[10, 0],
    // 	[12, 1],
    // ],
    Width: [
      [10, 5],
      [13, 10],
    ],
  },
  {
    // 国道
    Type: "f",
    Layer: "r4",
    Color: "239,220,148",
    // Color: 'efdc94',
  },
  {
    // 国道 // Zoom13以下のとき
    Type: "l",
    Layer: "r9",
    Color: "239,220,148",
    // Color: 'efdc94',
    // Border: 1,
    // OPacity: [
    // 	[10, 0],
    // 	[12, 1],
    // ],
    Width: [
      [10, 5],
      [13, 10],
      [16, 30],
    ],
  },
  {
    // トンネル
    Type: "l",
    Layer: "r6",
    Color: "100,100,100",
    // Color: '646464',
    Width: 2,
    Dash: [20, 20],
  },
  {
    // 水域
    Type: "f",
    Layer: "w",
    Color: "170,221,255",
    // Color: 'aaddff',
  },

  {
    // 緑
    Type: "f",
    Layer: "g",
    Color: "204,238,170",
    // Color: 'cceeaa',
  },

  // 文字用のレイヤ
  {
    Type: "p",
    Layer: "c",
    // text: "name",
    Color: "102,102,102",
    // Color: '666666',
    Size: 14,
    Padding: 10,
    // Css: {
    // 	"border-radius": "4px",
    // 	"background": "rgba(255,255,255,.5)",
    // 	"padding": "5px",
    // 	"font": "14px bold gothic",
    // 	"color": "#333",
    // }
  },
  {
    // 道路の文字
    Type: "p",
    Layer: "rt",
    // Color: "#fff",
    Size: 12,
    // text: "ref", //属性はnに統一
    // Padding: 10,
    // OPacity: [
    // 	[14, 0],
    // 	[14, 1],
    // ],
    Css: {
      "border": "1px solid #fff",
      "border-radius": "4px 4px 50% 50%",
      "background": "#06a",
      "padding": "5px",
      "color": "#fff",
    },
  },

  {
    Type: "p",
    Layer: "d",
    // text: "name",
    Color: "102,102,102",
    // Color: '666666',
    Size: 12,
    // Padding: 10,
    OPacity: [
      [13, 0],
      [14, 1],
    ],
  },
  {
    Type: "s",
    Layer: "p",
    // text: "name",
    // desc: "com",  tに変更
    // cat: "Type",  cに変更
    // Color: '102,102,102',
    // Size: 13,
  },

  // { // 水域
  // 	Type: "f",
  // 	Layer: "w2",
  // 	Color: '170,221,255',
  // },
];
