import { type SVGProps } from "react";

/**
 * klab cluster mark — an original, abstract "control-plane + nodes" wheel.
 *
 * Intentionally NOT the Kubernetes helm logo: a central control-plane node ringed
 * by six worker nodes on an orbit, evoking a cluster without reproducing any
 * trademarked CNCF artwork. Replace freely if you obtain rights to official marks
 * (see PROMPT.md placeholder: kubernetes-vector-logo-seeklogo).
 *
 * Decorative by default (`aria-hidden`). Pass a `title` to make it a labeled image.
 */
export function ClusterMark({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {/* orbit ring */}
      <circle
        cx="16"
        cy="16"
        r="11"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.25"
        strokeDasharray="2.5 2.5"
      />
      {/* spokes to three primary worker nodes */}
      <g stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.25">
        <line x1="16" y1="16" x2="16" y2="5" />
        <line x1="16" y1="16" x2="25.5" y2="21.5" />
        <line x1="16" y1="16" x2="6.5" y2="21.5" />
      </g>
      {/* worker nodes on the orbit */}
      <g fill="currentColor">
        <circle cx="16" cy="5" r="2.4" />
        <circle cx="25.5" cy="21.5" r="2.4" />
        <circle cx="6.5" cy="21.5" r="2.4" />
        <circle cx="25.5" cy="10.5" r="1.5" fillOpacity="0.55" />
        <circle cx="6.5" cy="10.5" r="1.5" fillOpacity="0.55" />
        <circle cx="16" cy="27" r="1.5" fillOpacity="0.55" />
      </g>
      {/* control-plane hub */}
      <circle cx="16" cy="16" r="4.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.7" fill="var(--color-app, #050505)" />
    </svg>
  );
}
