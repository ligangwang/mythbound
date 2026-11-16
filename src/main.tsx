import { createRoot } from "react-dom/client";
import "./mythbound.css";
import { connect } from "../sdk/dingn-sdk.js";
import { DingnProvider } from "./dingn";
import { MythboundGame } from "./game";

const sdk = await connect();
document.documentElement.lang = sdk.locale;
createRoot(document.getElementById("root")!).render(
  <DingnProvider sdk={sdk}>
    <MythboundGame />
  </DingnProvider>,
);
sdk.ready();
