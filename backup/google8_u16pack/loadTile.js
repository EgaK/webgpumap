import { VectorTile } from "./pbf/vectortile";
import { Pbf } from "./pbf/pbf";
import style from "./style";

export default async (zxy) => {
  var d = await fetch("https://sasepo.com/t/" + zxy.join("/"));
  d = await new Pbf(await d.arrayBuffer());
  var layers = new VectorTile(d).layers;
  var layer = layers["r1"];
  console.log(layer);
  console.log(layer.feature(10).toGeoJSON(zxy));

  console.log(layer.feature(10).loadGeometry());
};
