import { themeFromColor } from "./templates";
test("custom color derives a darker accent from the same channels", () => {
 expect(themeFromColor("#ff8040")).toEqual({ primary: "#FF8040", accent: "#733A1D" });
 expect(themeFromColor("#000000")).toEqual({ primary: "#000000", accent: "#000000" });
});
