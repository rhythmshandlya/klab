import type { SVGProps } from "react";

const NAME = "k8lab";

/**
 * Public product identity. Change product copy, destinations, or logo colors here.
 * Runtime identifiers such as cookies, storage keys, and simulated image names are
 * intentionally not branding: they remain stable so existing user data keeps working.
 */
export const BRAND = {
  name: NAME,
  teamName: `${NAME} Team`,
  accountName: `${NAME} account`,
  communityMemberName: `${NAME} community member`,
  tagline: "learn Kubernetes by doing",
  shortDescription: "Hands-on Kubernetes practice in your browser.",
  description:
    "A gamified, hands-on Kubernetes learning platform. Debug broken clusters, experiment in a sandbox, and study interactive lessons, all simulated in your browser.",
  repositoryUrl: "https://github.com/rhythmshandlya/klab",
  siteOrigin: "https://klab-five.vercel.app",
  logo: {
    title: `${NAME} logo`,
    accentColor: "#0070f3",
    backgroundColor: "#050505",
    foregroundColor: "#f8fafc",
    assets: {
      favicon: "/brand/k8lab-cluster-favicon.png",
      appIcon: "/brand/k8lab-cluster-app-icon.png",
      mark: "/brand/k8lab-cluster-mark.png",
      markOnDark: "/brand/k8lab-cluster-mark-white.png",
      markOnLight: "/brand/k8lab-cluster-mark-black.png",
      lockupOnDark: "/brand/k8lab-cluster-lockup-on-dark.png",
      lockupOnLight: "/brand/k8lab-cluster-lockup-on-light.png",
    },
  },
} as const;

/**
 * The product mark used by navigation, landing surfaces, docs, and the generated favicon.
 * Decorative by default. Pass a title when the mark itself conveys the brand identity.
 */
export function BrandMark({
  title,
  style,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={style}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <image
        href={BRAND.logo.assets.mark}
        width="32"
        height="32"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
