import type { NextConfig } from "next";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserSite = repository.endsWith(".github.io");
const githubBasePath = process.env.GITHUB_ACTIONS === "true" && repository && !isUserSite
  ? `/${repository}`
  : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: githubBasePath,
  assetPrefix: githubBasePath,
};

export default nextConfig;
