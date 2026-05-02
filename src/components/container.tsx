type Props = {
  children: React.ReactNode;
};

export default function Contenedor({ children }: Props) {
  return (
    <div className="container">
      {children}
    </div>
  );
}