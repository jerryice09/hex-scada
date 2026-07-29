import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages로 배포할 경우, 저장소 이름이 "hex-scada"가 아니라면
// base 값을 "/실제-저장소-이름/" 형태로 바꿔주세요. (예: base: "/hex-scada/")
// Vercel/Netlify로 배포할 경우에는 base를 "/"로 두면 됩니다.
export default defineConfig({
  plugins: [react()],
  base: "/",
});
