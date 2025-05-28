import { Coord } from "../../model/coord";
import { Joint } from "../../model/joint";
import { InteractionService } from "../../services/interaction.service";
import { ClickCapture, ClickCaptureID } from "./click-capture";
import { JointInteractor } from "../joint-interactor";

export class CreateLinkFromJointCapture extends ClickCapture {

    constructor(private parentJoint: Joint, private interactionService: InteractionService) {
        super(ClickCaptureID.CREATE_LINK_FROM_JOINT);

        // on mouse move, if hovering over a Joint, store it
        this.onMouseMove$.subscribe(() => {
        });
    }

    // Returns the coordinates of the joint from which the new link starts
    public getStartPos(): Coord {
        return this.parentJoint.coords;
    }

    // Returns the currently hovered joint, if any
    public getHoveringJoint(): Joint | undefined {
        const hovering = this.interactionService.getHoveringObject();
            if (hovering instanceof JointInteractor) {
                return hovering.joint;
            } else {
                return undefined;
            }
    }

}
