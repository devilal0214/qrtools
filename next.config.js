/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["res.cloudinary.com"],
    // OR if you want to be extra strict, you can use remotePatterns instead:
    // remotePatterns: [
    //   {
    //     protocol: 'https',
    //     hostname: 'res.cloudinary.com',
    //     pathname: '/dm5tibqnw/**', // your cloud name path
    //   },
    // ],
  },
};

module.exports = nextConfig;
