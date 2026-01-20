import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/generations")({
  component: GenerationsLayout,
});

function GenerationsLayout() {
  return <Outlet />;
}
