import { Coord } from "../../model/coord";
import { Link } from "../../model/link";
import { InteractionService } from "../../services/interaction.service";
import { ClickCapture, ClickCaptureID } from "./click-capture";
import { LinkInteractor } from "../link-interactor";
import { CompoundLink } from "../../model/compound-link";

export class CreateLinkFromLinkCapture extends ClickCapture {


    private hoveringLink?: Link;

    constructor(private parentLink: Link, private startPos: Coord, private interactionService: InteractionService) {
        super(ClickCaptureID.CREATE_LINK_FROM_LINK);



        // on mouse move, if hovering over a Link, store it
        this.onMouseMove$.subscribe((event) => {
            const hovering = interactionService.getHoveringObject();
            if (hovering instanceof LinkInteractor) {
                this.hoveringLink = hovering.link;
            } else {
                this.hoveringLink = undefined;
            }
        });

    }

    public getHoveringLink(): Link | undefined {
        return this.hoveringLink;
    }
    public getStartPos(): Coord{
        return this.startPos;
    }
}
