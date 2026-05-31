import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("framer-motion", () => {
  const React = require("react");
  const create = (Tag: keyof JSX.IntrinsicElements) => {
    return React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement(Tag, { ref, ...props }, children)
    );
  };

  return {
    motion: new Proxy(
      {},
      {
        get: (_target, key) => create((key as keyof JSX.IntrinsicElements) ?? "div"),
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Translate: {
      toString: () => "",
    },
  },
}));

jest.mock("lucide-react", () => {
  const React = require("react");
  const Icon = ({ "data-testid": dataTestId = "icon", ...props }: any) =>
    React.createElement("svg", { ...props, "data-testid": dataTestId });

  return new Proxy(
    {},
    {
      get: (_target, key) => Icon,
    }
  );
});