/**
 * The second half of the nav transition.
 *
 * This is a `template` rather than part of the layout on purpose: Next mounts a
 * fresh instance of it on every navigation, so the entrance animation replays
 * when a shopper moves from one category to the next. A layout would be reused
 * and the animation would run exactly once, on first load.
 *
 * It is a Server Component — the animation is pure CSS, so this costs nothing
 * on the client.
 */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return <div className="rp-page-enter">{children}</div>;
}
