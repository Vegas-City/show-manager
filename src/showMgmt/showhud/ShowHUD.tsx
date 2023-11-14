import * as utils from '@dcl-sdk/utils'
import { engine, executeTask } from "@dcl/sdk/ecs"
import { Color4 } from "@dcl/sdk/math"
import { isPreviewMode } from "~system/EnvironmentApi"
import ReactEcs, { UiEntity } from "@dcl/sdk/react-ecs"

enum ClickAnimationButton {
    PREV,
    NEXT,
    RESTART,
    PAUSE_PLAY,
    RUN_OF_SHOW_PAUSE_PLAY
}

export class ShowHUD {
    static instances: ShowHUD[] = []

    defaultParent: any
    uiMaximized: boolean = false

    //as a property lets users change it if need be
    imageAtlas = "images/controlUI.png"

    onRunOfShowRestart: () => void = () => { }
    onPause: () => void = () => { }
    onPlay: () => void = () => { }
    onPlayNext: () => void = () => { }
    onPlayPrev: () => void = () => { }
    onRunOfShowPlay: () => void = () => { }
    onRunOfShowPause: () => void = () => { }

    clickAnimationActive: boolean = false
    clickAnimationButton: ClickAnimationButton = ClickAnimationButton.PAUSE_PLAY
    clickAnimationTimer: number = 0.1

    noticeActive: boolean = false

    hudVisibility: boolean = true
    paused: boolean = true
    runOfShowPaused: boolean = true

    // Button Opacities
    prevButtonOpacity: number = 1
    nextButtonOpacity: number = 1
    pausePlayButtonOpacity: number = 1
    runOfShowPausePlayButtonOpacity: number = 1
    restartButtonOpacity: number = 1

    // Text Values
    displayNameValue: string = ""
    videoStatusValue: string = "READY"
    playTimesValue: string = "-/-/-"
    playTimesLabelValue: string = "video/lapse/subtitle"
    actionCountsValue: string = "-/-/-"
    actionCountsLabelValue: string = "processed/warnings/errors"
    notificationLabelValue: string = ""

    notificationTimerId: number = -1

    component = () => {
        return (
            <UiEntity
                uiTransform={{
                    position: { right: '0px', bottom: '110px' },
                    positionType: 'absolute',
                    display: this.hudVisibility ? 'flex' : 'none',
                }}
            >
                <UiEntity
                    uiTransform={{
                        width: 204,
                        height: 314,
                        position: { right: '0px', bottom: '0' },
                        positionType: 'absolute',
                        display: this.uiMaximized ? 'flex' : 'none',
                    }}
                    uiBackground={{
                        color: Color4.create(0, 0, 0, 0.75)
                    }}
                >
                    <UiEntity // Next Button
                        uiTransform={{
                            width: 52,
                            height: 52,
                            position: { right: '19px', bottom: '250px' },
                            positionType: 'absolute',
                        }}
                        uiBackground={{
                            texture: { src: this.imageAtlas },
                            textureMode: 'stretch',
                            uvs: [
                                0.097, 0.597,
                                0.097, 0.712,
                                0.171, 0.712,
                                0.171, 0.597
                            ],
                            color: Color4.create(1, 1, 1, this.nextButtonOpacity)
                        }}
                        onMouseDown={() => {
                            this.triggerClickAnimation(ClickAnimationButton.NEXT)

                            if (this.onPlayNext) this.onPlayNext()
                        }}
                    >
                    </UiEntity>
                    <UiEntity // Pause/Play Button
                        uiTransform={{
                            width: 52,
                            height: 52,
                            position: { right: '76.5px', bottom: '250px' },
                            positionType: 'absolute',
                        }}
                        uiBackground={{
                            texture: { src: this.imageAtlas },
                            textureMode: 'stretch',
                            uvs: [
                                this.paused ? 0.178 : 0.097, this.paused ? 0.175 : 0.456,
                                this.paused ? 0.178 : 0.097, this.paused ? 0.291 : 0.572,
                                this.paused ? 0.252 : 0.171, this.paused ? 0.291 : 0.572,
                                this.paused ? 0.252 : 0.171, this.paused ? 0.175 : 0.456,
                            ],
                            color: Color4.create(1, 1, 1, this.pausePlayButtonOpacity)
                        }}
                        onMouseDown={() => {
                            this.paused = !this.paused
                            this.triggerClickAnimation(ClickAnimationButton.PAUSE_PLAY)
                            if (this.paused) {
                                if (this.onPlay) this.onPlay()
                            }
                            else {
                                if (this.onPause) this.onPause()
                            }
                        }}
                    >
                    </UiEntity>
                    <UiEntity // Prev Button
                        uiTransform={{
                            width: 52,
                            height: 52,
                            position: { right: '134px', bottom: '250px' },
                            positionType: 'absolute',
                        }}
                        uiBackground={{
                            texture: { src: this.imageAtlas },
                            textureMode: 'stretch',
                            uvs: [
                                0.016, 0.597,
                                0.016, 0.712,
                                0.09, 0.712,
                                0.09, 0.597
                            ],
                            color: Color4.create(1, 1, 1, this.prevButtonOpacity)
                        }}
                        onMouseDown={() => {
                            this.triggerClickAnimation(ClickAnimationButton.PREV)

                            if (this.onPlayPrev) this.onPlayPrev()
                        }}
                    >
                    </UiEntity>
                    <UiEntity // RunOfShow Pause/Play Button
                        uiTransform={{
                            width: 52,
                            height: 52,
                            position: { right: '76.5px', bottom: '38px' },
                            positionType: 'absolute',
                        }}
                        uiBackground={{
                            texture: { src: this.imageAtlas },
                            textureMode: 'stretch',
                            uvs: [
                                0.178, this.runOfShowPaused ? 0.175 : 0.315,
                                0.178, this.runOfShowPaused ? 0.291 : 0.432,
                                0.252, this.runOfShowPaused ? 0.291 : 0.432,
                                0.252, this.runOfShowPaused ? 0.175 : 0.315,
                            ],
                            color: Color4.create(1, 1, 1, this.runOfShowPausePlayButtonOpacity)
                        }}
                        onMouseDown={() => {
                            this.runOfShowPaused = !this.runOfShowPaused
                            this.triggerClickAnimation(ClickAnimationButton.RUN_OF_SHOW_PAUSE_PLAY)
                            if (this.runOfShowPaused) {
                                if (this.onRunOfShowPlay) this.onRunOfShowPlay()
                            }
                            else {
                                if (this.onRunOfShowPause) this.onRunOfShowPause()
                            }
                        }}
                    >
                    </UiEntity>
                    <UiEntity // Restart Button
                        uiTransform={{
                            width: 52,
                            height: 52,
                            position: { right: '134px', bottom: '38px' },
                            positionType: 'absolute',
                        }}
                        uiBackground={{
                            texture: { src: this.imageAtlas },
                            textureMode: 'stretch',
                            uvs: [
                                0.908, 0.315,
                                0.908, 0.432,
                                0.982, 0.432,
                                0.982, 0.315
                            ],
                            color: Color4.create(1, 1, 1, this.restartButtonOpacity)
                        }}
                        onMouseDown={() => {
                            this.runOfShowPaused = true
                            this.triggerClickAnimation(ClickAnimationButton.RESTART)

                            if (this.onRunOfShowRestart) this.onRunOfShowRestart()
                        }}
                    >
                    </UiEntity>
                    <UiEntity // Display Name
                        uiTransform={{
                            position: { right: '0px', bottom: '225px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.displayNameValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 16
                        }}>
                    </UiEntity>
                    <UiEntity // Video Status
                        uiTransform={{
                            position: { right: '0px', bottom: '200px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.videoStatusValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 16
                        }}>
                    </UiEntity>
                    <UiEntity // Play Times
                        uiTransform={{
                            position: { right: '0px', bottom: '175px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.playTimesValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 16
                        }}>
                    </UiEntity>
                    <UiEntity // Play Times Label
                        uiTransform={{
                            position: { right: '0px', bottom: '162px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.playTimesLabelValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 11
                        }}>
                    </UiEntity>
                    <UiEntity // Action Counts
                        uiTransform={{
                            position: { right: '0px', bottom: '136px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.actionCountsValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 16
                        }}>
                    </UiEntity>
                    <UiEntity // Action Counts Label
                        uiTransform={{
                            position: { right: '0px', bottom: '123px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.actionCountsLabelValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 11
                        }}>
                    </UiEntity>
                    <UiEntity // Show Manager Label
                        uiTransform={{
                            position: { right: '0px', bottom: '25px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: "Show Manager",
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 16
                        }}>
                    </UiEntity>
                    <UiEntity // Notification Label
                        uiTransform={{
                            position: { right: '0px', bottom: '10px' },
                            positionType: 'absolute',
                            width: "100%",
                            justifyContent: 'center'
                        }}
                        uiText={{
                            value: this.notificationLabelValue,
                            textAlign: "bottom-center",
                            font: "sans-serif",
                            fontSize: 12
                        }}>
                    </UiEntity>
                </UiEntity>
                <UiEntity // Maximize Button
                    uiTransform={{
                        width: 52,
                        height: 52,
                        position: { right: '19px', bottom: '38px' },
                        positionType: 'absolute',
                    }}
                    uiBackground={{
                        texture: { src: this.imageAtlas },
                        textureMode: 'stretch',
                        uvs: [
                            this.uiMaximized ? 0.908 : 0.826, 0.034,
                            this.uiMaximized ? 0.908 : 0.826, 0.15,
                            this.uiMaximized ? 0.982 : 0.9, 0.15,
                            this.uiMaximized ? 0.982 : 0.9, 0.034
                        ],
                    }}
                    onMouseDown={() => {
                        this.uiMaximized ? this.minimizeUI() : this.maximizeUI()
                    }}
                >
                </UiEntity>
            </UiEntity >)
    }

    constructor() {
        const hud = this

        executeTask(async () => {
            if (await isPreviewMode({})) {
                console.log("in preview mode")
                hud.hudVisibility = true
            }
            else {
                console.log("not in preview mode")
                hud.hudVisibility = false
            }
        })
        if (ShowHUD.instances.length < 1) {
            engine.addSystem(ShowHUD.clickAnimationSystem)
        }

        ShowHUD.instances.push(this)
    }

    setSnaps() {

    }
    applyModeAndSnapLabels() {

    }
    maximizeUI() {
        this.uiMaximized = true
        //this.applyModeAndSnapLabels()
        this.displayNameValue = "display name"
    }
    minimizeUI() {
        this.uiMaximized = false
    }
    showUI() {
        this.hudVisibility = true
    }
    hideUI() {
        this.hudVisibility = false
    }
    selectEntity(selectedEntityIndex: number) {
        console.log("Select Entity isn't implemented at this time.")
    }
    selectPrevious() {
        console.log("Select Previous isn't implemented at this time.")
    }
    selectNext() {
        console.log("Select Next isn't implemented at this time.")
    }
    discardSelected() {
        console.log("Discard Selected Entity isn't implemented at this time.")
    }

    toggleCameraOptions() {
        console.log("Toggle Camera Options isn't implemented at this time.")
    }

    round(n: number): number {
        return Math.floor((n + 0.00049) * 1000) / 1000
    }

    triggerClickAnimation(button: ClickAnimationButton): void {
        switch (this.clickAnimationButton) {
            case ClickAnimationButton.PREV:
                this.prevButtonOpacity = 1
                break
            case ClickAnimationButton.NEXT:
                this.nextButtonOpacity = 1
                break
            case ClickAnimationButton.RESTART:
                this.restartButtonOpacity = 1
                break
            case ClickAnimationButton.PAUSE_PLAY:
                this.pausePlayButtonOpacity = 1
                break
            case ClickAnimationButton.RUN_OF_SHOW_PAUSE_PLAY:
                this.runOfShowPausePlayButtonOpacity = 1
                break
        }
        this.clickAnimationButton = button
        this.clickAnimationTimer = 0.1
        this.clickAnimationActive = true
    }

    setNotificationText(): void {
        this.notificationLabelValue = "Disable run of show first!"

        if (this.notificationTimerId > 0) {
            utils.timers.clearTimeout(this.notificationTimerId)
        }
        const self = this
        this.notificationTimerId = utils.timers.setTimeout(
            function () {
                self.notificationLabelValue = ""
            },
            4000
        )
    }

    static clickAnimationSystem(dt: number) {
        for (let hud of ShowHUD.instances) {
            if (!hud.clickAnimationActive) continue

            switch (hud.clickAnimationButton) {
                case ClickAnimationButton.PREV: {
                    if (hud.clickAnimationTimer > 0) {
                        hud.prevButtonOpacity -= 0.3
                        hud.clickAnimationTimer -= dt
                    } else {
                        hud.clickAnimationTimer = 0.1
                        hud.prevButtonOpacity = 1
                        hud.clickAnimationActive = false
                    }
                }
                    break
                case ClickAnimationButton.NEXT: {
                    if (hud.clickAnimationTimer > 0) {
                        hud.nextButtonOpacity -= 0.3
                        hud.clickAnimationTimer -= dt
                    } else {
                        hud.clickAnimationTimer = 0.1
                        hud.nextButtonOpacity = 1
                        hud.clickAnimationActive = false
                    }
                }
                    break
                case ClickAnimationButton.RESTART: {
                    if (hud.clickAnimationTimer > 0) {
                        hud.restartButtonOpacity -= 0.3
                        hud.clickAnimationTimer -= dt
                    } else {
                        hud.clickAnimationTimer = 0.1
                        hud.restartButtonOpacity = 1
                        hud.clickAnimationActive = false
                    }
                }
                    break
                case ClickAnimationButton.PAUSE_PLAY: {
                    if (hud.clickAnimationTimer > 0) {
                        hud.pausePlayButtonOpacity -= 0.3
                        hud.clickAnimationTimer -= dt
                    } else {
                        hud.clickAnimationTimer = 0.1
                        hud.pausePlayButtonOpacity = 1
                        hud.clickAnimationActive = false
                    }
                }
                    break
                case ClickAnimationButton.RUN_OF_SHOW_PAUSE_PLAY: {
                    if (hud.clickAnimationTimer > 0) {
                        hud.runOfShowPausePlayButtonOpacity -= 0.3
                        hud.clickAnimationTimer -= dt
                    } else {
                        hud.clickAnimationTimer = 0.1
                        hud.runOfShowPausePlayButtonOpacity = 1
                        hud.clickAnimationActive = false
                    }
                }
                    break
            }
        }
    }

    static render() {
        return Array(...ShowHUD.instances).map(hud => hud.component())
    }
}