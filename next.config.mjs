/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/timer", destination: "/timer/index.html" },
      { source: "/board", destination: "/timer/board.html" },
      { source: "/display", destination: "/timer/display.html" },
      { source: "/remote", destination: "/timer/remote.html" },
      { source: "/bar-calculator", destination: "/timer/bar-calculator.html" },
      { source: "/counter", destination: "/timer/counter.html" },
    ];
  },
};

export default nextConfig;
