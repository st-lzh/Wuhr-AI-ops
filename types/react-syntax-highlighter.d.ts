declare module 'react-syntax-highlighter' {
  export interface SyntaxHighlighterProps {
    language?: string
    style?: any
    children?: React.ReactNode
    customStyle?: React.CSSProperties
    codeTagProps?: React.HTMLAttributes<HTMLElement>
    useInlineStyles?: boolean
    showLineNumbers?: boolean
    wrapLines?: boolean
    lineProps?: any
    className?: string
  }

  export const Prism: React.ComponentType<SyntaxHighlighterProps>
  export default React.ComponentType<SyntaxHighlighterProps>
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: any
  export const oneLight: any
  export const prism: any
  export const tomorrow: any
  export const twilight: any
  export const vs: any
  export const vscDarkPlus: any
}

declare module 'react-syntax-highlighter/dist/cjs/styles/prism' {
  export const oneDark: any
  export const oneLight: any
  export const prism: any
  export const tomorrow: any
  export const twilight: any
  export const vs: any
  export const vscDarkPlus: any
} 