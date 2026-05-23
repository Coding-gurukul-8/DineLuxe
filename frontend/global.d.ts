// Declare CSS file imports as side-effect modules so TypeScript doesn't
// error on `import './globals.css'` and similar bare CSS imports.
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}