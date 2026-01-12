# 測試 Fixtures

## 產生測試音檔

測試需要一個小的 MP3 音檔。你可以使用 FFmpeg 產生一個 3 秒的靜音檔：

```bash
# 產生 3 秒靜音 MP3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 3 -q:a 9 tests/fixtures/test-audio.mp3

# 或者產生帶有簡單音調的音檔
ffmpeg -f lavfi -i "sine=frequency=440:duration=3" -q:a 9 tests/fixtures/test-audio.mp3
```

如果沒有 FFmpeg，也可以使用任何小於 1MB 的 MP3 檔案。

## 檔案列表

- `mock-data.ts` - 測試用的 mock 資料
- `test-helpers.ts` - 測試輔助函式
- `auth-helpers.ts` - 認證相關輔助函式
- `test-audio.mp3` - 測試用音檔（需自行產生）
