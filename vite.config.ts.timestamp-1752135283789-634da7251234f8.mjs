// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react()
  ],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    rollupOptions: {
      input: "index.html"
    }
  },
  server: {
    cors: true,
    // This enables basic CORS
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => {
        res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:; style-src * 'unsafe-inline' 'unsafe-eval'; font-src * data:; frame-src * 'unsafe-inline' 'unsafe-eval';");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "86400");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        next();
      });
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpXG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6ICdpbmRleC5odG1sJ1xuICAgIH1cbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgY29yczogdHJ1ZSwgLy8gVGhpcyBlbmFibGVzIGJhc2ljIENPUlNcbiAgICBjb25maWd1cmVTZXJ2ZXI6IChzZXJ2ZXIpID0+IHtcbiAgICAgIC8vIE1pZGRsZXdhcmUgdG8gaW5qZWN0IGN1c3RvbSBoZWFkZXJzXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVNlY3VyaXR5LVBvbGljeScsIFwiZGVmYXVsdC1zcmMgKiAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBkYXRhOiBibG9iOjsgc2NyaXB0LXNyYyAqICd1bnNhZmUtaW5saW5lJyAndW5zYWZlLWV2YWwnOyBjb25uZWN0LXNyYyAqICd1bnNhZmUtaW5saW5lJyAndW5zYWZlLWV2YWwnOyBpbWctc3JjICogZGF0YTogYmxvYjo7IHN0eWxlLXNyYyAqICd1bnNhZmUtaW5saW5lJyAndW5zYWZlLWV2YWwnOyBmb250LXNyYyAqIGRhdGE6OyBmcmFtZS1zcmMgKiAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJztcIik7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnKicpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJywgJyonKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnLCAndHJ1ZScpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1NYXgtQWdlJywgJzg2NDAwJyk7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ1gtQ29udGVudC1UeXBlLU9wdGlvbnMnLCAnbm9zbmlmZicpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdSZWZlcnJlci1Qb2xpY3knLCAnc3RyaWN0LW9yaWdpbi13aGVuLWNyb3NzLW9yaWdpbicpO1xuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBLElBQ04saUJBQWlCLENBQUMsV0FBVztBQUUzQixhQUFPLFlBQVksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO0FBQ3pDLFlBQUksVUFBVSwyQkFBMkIsa1JBQWtSO0FBQzNULFlBQUksVUFBVSwrQkFBK0IsR0FBRztBQUNoRCxZQUFJLFVBQVUsZ0NBQWdDLEdBQUc7QUFDakQsWUFBSSxVQUFVLGdDQUFnQyxHQUFHO0FBQ2pELFlBQUksVUFBVSxvQ0FBb0MsTUFBTTtBQUN4RCxZQUFJLFVBQVUsMEJBQTBCLE9BQU87QUFDL0MsWUFBSSxVQUFVLDBCQUEwQixTQUFTO0FBQ2pELFlBQUksVUFBVSxtQkFBbUIsaUNBQWlDO0FBQ2xFLGFBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
