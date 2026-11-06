// TypeScript declarations for Expo/Metro CSS imports. Metro handles the
// actual stylesheet files at runtime; these types enable CI type checking.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
