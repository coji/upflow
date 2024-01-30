type SpacerProps = React.HTMLAttributes<HTMLDivElement>
const Spacer = ({ ...rest }: SpacerProps) => (
  <div className="flex-1 block self-stretch" {...rest} />
)
Spacer.displayName = 'Spacer'
export { Spacer }
