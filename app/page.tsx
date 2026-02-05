import LoginForm from "@/components/auth/LoginForm";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-foreground to-primary p-4">
      <LoginForm />
    </div>
  );
}
