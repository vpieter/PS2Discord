import { extend, isNil } from "lodash";
import { ps2MainOutfit, ps2RestClient } from "../../app";
import { consoleCatch } from "../../utils";

export class MainOutfitUpdater {
  private _started = false;
  private _interval: NodeJS.Timer | null = null;

  get started(): boolean {
    return this._started;
  }

  start() {
    if (this.started) return;

    this._interval = setInterval(this._updateMainOutfit, 1000 * 60 * 30);

    this._started = true;
  }

  stop() {
    if (!this.started) return;
    if (this._interval === null) return;

    clearInterval(this._interval);

    this._started = false;
  }

  // private methods
  private _updateMainOutfit = async () => {
    const mainOutfit = await ps2RestClient.getMainOutfit().catch(consoleCatch);
    if (mainOutfit) {
      if (!isNil(mainOutfit?.faction?.id) && !isNil(mainOutfit?.members[0]?.id)) extend(ps2MainOutfit, mainOutfit);
    }
  }
}
