import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 기본값은 Vercel/Netlify처럼 도메인 루트에 배포하는 경우("/") 기준입니다.
// GitHub Pages처럼 저장소 하위 경로(https://계정.github.io/저장소명/)에 배포할 때만
// base를 "/저장소명/" 형태로 바꿔주세요. (예: base: "/hex-scada/")
export default defineConfig({
  plugins: [react()],
  base: "/",
});
