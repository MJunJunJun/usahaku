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


test("dragging in the preview saves on release without an edit or save button", async () => {
 const site={id:'site',businessName:'Uji',products:[],templateStyle:'playful',themeConfig:{coverPosition:{x:75,y:25}},aiGeneratedContent:{heroTitle:'Uji'}};
 api.get.mockResolvedValue({data:site});api.put.mockResolvedValue({data:site});
 await act(async () => root.render(<MemoryRouter><WebsiteDetail /></MemoryRouter>));
 expect(container.querySelector('[data-testid="edit-cover-position"]')).toBeNull();
 const img=container.querySelector('[data-testid="draggable-cover-image"]');
 for (const [key,value] of Object.entries({naturalWidth:800,naturalHeight:400,clientWidth:400,clientHeight:400})) Object.defineProperty(img,key,{value});
 img.setPointerCapture=jest.fn();img.hasPointerCapture=()=>true;img.releasePointerCapture=jest.fn();
 await act(async () => img.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:100,clientY:100,button:0})));
 await act(async () => img.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:180,clientY:100})));
 expect(api.put).not.toHaveBeenCalled();
 await act(async () => img.dispatchEvent(new MouseEvent('pointerup',{bubbles:true})));
 expect(api.put).toHaveBeenCalledTimes(1);
 expect(api.put).toHaveBeenCalledWith('/websites/undefined/theme',{coverPosition:{x:55,y:25}});
 expect(container.querySelector('[data-testid="save-cover-position"]')).toBeNull();
 expect(container.querySelector('[data-testid="draggable-cover-image"]').style.objectPosition).toBe('55% 25%');
});
