import React, { act } from "react";
import { createRoot } from "react-dom/client";

global.IS_REACT_ACT_ENVIRONMENT = true;
const { MemoryRouter } = require("react-router-dom");
const { WebsiteDetail } = require("./Dashboard");
const { UserSidebar } = require("../lib/shared");
const { api } = require("../lib/api");

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), put: jest.fn() }, daysUntil: () => 0, resolveMediaUrl: value => value }));
jest.mock("../lib/seo", () => ({ NoIndex: () => null }));
jest.mock("@/lib/utils", () => require("../lib/utils"), { virtual: true });
jest.mock("react-router-dom", () => ({
  MemoryRouter: ({ children }) => <>{children}</>,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  NavLink: ({ to, children, end, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
}), { virtual: true });

let container;
let root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); });


test("photo crop opens with saved position and saves an explicit reset", async () => {
 const site={id:'site',businessName:'Uji',products:[],templateStyle:'playful',themeConfig:{coverPosition:{x:75,y:25}},aiGeneratedContent:{heroTitle:'Uji'}};
 api.get.mockResolvedValue({data:site});api.put.mockResolvedValue({data:{...site,themeConfig:{coverPosition:{x:50,y:50}}}});
 await act(async () => root.render(<MemoryRouter><WebsiteDetail /></MemoryRouter>));
 await act(async () => container.querySelector('[data-testid="edit-cover-position"]').click());
 expect(container.querySelector('[data-testid="cover-position-x"]').value).toBe('75');
 expect(container.querySelector('[data-testid="cover-position-y"]').value).toBe('25');
 expect(container.querySelector('[data-testid="draggable-cover-image"]')).not.toBeNull();
 await act(async () => container.querySelector('[data-testid="reset-cover-position"]').click());
 await act(async () => container.querySelector('[data-testid="save-cover-position"]').click());
 expect(api.put).toHaveBeenCalledWith('/websites/undefined/theme',{coverPosition:{x:50,y:50}});
 expect(container.querySelector('[data-testid="draggable-cover-image"]')).toBeNull();
});
