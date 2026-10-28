// Kit 3's resolve() reads a leading "/" as a route ID and wants a pathname
// without it ("master/roles", not "/master/roles"). The app's own pathnames
// keep their slash, since they are compared with `page.url.pathname` and
// redirected to; this drops it on the way into resolve().
export function appPath<P extends string>(pathname: `/${P}`): P {
  return pathname.slice(1) as P;
}
