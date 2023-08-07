type SpacerProps = React.HTMLAttributes<HTMLDivElement>
const Spacer = ({ ...rest }: SpacerProps) => <div className="block flex-1 self-stretch" {...rest} />
Spacer.displayName = 'Spacer'
export { Spacer }
