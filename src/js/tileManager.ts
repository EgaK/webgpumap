// タイルの状態定義
type TileState = "LOADING" | "READY" | "ABORTED";

interface Tile {
  key: string; // "z/x/y"
  z: number;
  x: number;
  y: number;
  state: TileState;
  abortController: AbortController;
  // 後ほどここにバッファプールの情報（オフセット、ページ数など）が追加されます
  bufferAllocation?: { offset: number; size: number; pageIndices: number[] };
}

class TileManager {
  // 現在メモリ/GPUに保持しているタイルのキャッシュ
  private activeTiles: Map<string, Tile> = new Map();

  constructor() {
    // 必要に応じて、ここでバッファプールのインスタンスを受け取る
  }

  /**
   * 毎フレーム、またはカメラが動いたときに呼び出されるメイン関数
   */
  public update(camera: any) {
    // 1. 現在のカメラ位置から、画面内に必要なタイルのキー（"z/x/y"）を計算
    const visibleTileKeys = this.calculateVisibleTiles(camera);
    const visibleKeySet = new Set(visibleTileKeys);

    // 2. 不要になったタイル（画面外に出たタイル）のクリーンアップ・キャンセル
    for (const [key, tile] of this.activeTiles.entries()) {
      if (!visibleKeySet.has(key)) {
        this.unloadTile(tile);
        this.activeTiles.delete(key);
      }
    }

    // 3. 新しく画面内に入ったタイルのロード
    for (const key of visibleTileKeys) {
      if (!this.activeTiles.has(key)) {
        this.loadTile(key);
      }
    }
  }

  /**
   * タイルのロード処理（非同期）
   */
  private async loadTile(key: string) {
    const [z, x, y] = key.split("/").map(Number);
    const abortController = new AbortController();

    const tile: Tile = {
      key,
      z,
      x,
      y,
      state: "LOADING",
      abortController,
    };

    this.activeTiles.set(key, tile);

    try {
      // FetchとMVTパース（AbortSignalを渡すのがモダンなポイント）
      const pbfData = await this.fetchTilePbf(z, x, y, abortController.signal);
      const geometryData = await this.parseMvt(pbfData, abortController.signal);

      // ロード中にユーザーが別の場所にスクロールして、すでにABORTされていたら中断
      if (tile.state === "ABORTED") return;

      // ーーー 【ここに後でバッファプールが割り込みます】 ーーー
      // 例: const alloc = bufferPool.allocate(geometryData.totalBytes);
      //     device.queue.writeBuffer(poolBuffer, alloc.offset, ...);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      tile.state = "READY";
      this.triggerRender(); // 再描画要求
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log(`Tile load aborted: ${key}`);
      } else {
        console.error(`Failed to load tile: ${key}`, error);
        this.activeTiles.delete(key);
      }
    }
  }

  /**
   * タイルの解放処理
   */
  private unloadTile(tile: Tile) {
    if (tile.state === "LOADING") {
      // まだ通信中・パース中ならネットワークと処理を即座にキャンセル！
      tile.state = "ABORTED";
      tile.abortController.abort();
    }

    if (tile.state === "READY") {
      // ーーー 【ここに後でバッファプールの解放が入ります】 ーーー
      // 例: bufferPool.free(tile.bufferAllocation);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    }
  }

  /**
   * 現在のカメラから画面内に入るタイルのXY座標を計算する（カリング）
   */
  private calculateVisibleTiles(camera: any): string[] {
    // TODO: カメラのバウンディングボックスとズームから、交差するタイルの z/x/y 配列を返す
    // ※ 既存のCanvas2Dアプリのロジックがそのまま流用できます
    return ["10/896/364", "10/897/364"]; // 仮のダミー
  }

  private async fetchTilePbf(
    z: number,
    x: number,
    y: number,
    signal: AbortSignal,
  ): Promise<ArrayBuffer> {
    const url = `https://example.com{z}/${x}/${y}.pbf`;
    const response = await fetch(url, { signal });
    return await response.arrayBuffer();
  }

  private async parseMvt(pbf: ArrayBuffer, signal: AbortSignal): Promise<any> {
    // 巨大なMVTのパースは重いため、可能であれば今後 Web Worker を使って
    // 別スレッドでパースし、頂点/インデックスの ArrayBuffer を Transferable で受け取るのがモダンかつ最速です。
    return {/* 頂点データなど */};
  }

  private triggerRender() {
    /* WebGPUの描画ループ（requestAnimationFrame）を叩く */
  }

  /**
   * 描画関数から呼ばれ、現在READYなバッファだけをWebGPUにセットして描画する
   */
  public getRenderableTiles(): Tile[] {
    return Array.from(this.activeTiles.values()).filter(
      (t) => t.state === "READY",
    );
  }
}
