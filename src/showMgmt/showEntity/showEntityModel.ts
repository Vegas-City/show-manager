import { ShowEntitySupport, SyncedEntityModelExtConstructorArgs } from './showEntity'
import { Animator, Entity, GltfContainer, PBAnimationState, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'

export class ShowEntityModel extends ShowEntitySupport {
  public idleAnim: PBAnimationState | null = null
  public endAnimTimerId: number | null = null
  public intervalAnimTimerId: number | null = null
  public entity: Entity

  private entityScale: Vector3

  constructor(
    model: string,
    extArgs: SyncedEntityModelExtConstructorArgs
  ) {
    super()

    this.entity = engine.addEntity()

    GltfContainer.create(this.entity, {
      src: model
    })

    const transform = Transform.create(this.entity, {
      position: extArgs.transform ? extArgs.transform.position : Vector3.Zero(),
      rotation: extArgs.transform ? extArgs.transform.rotation : Quaternion.Identity(),
      scale: extArgs.transform ? extArgs.transform.scale : Vector3.One(),
    })
    this.entityScale = Vector3.clone(transform.scale)

    if (extArgs.startInvisible) {
      this.hide()
    }

    let initAnimator = extArgs.initAnimator === undefined || extArgs.initAnimator === true

    if (initAnimator) {
      this.ensureHasAnimator()
    }

    if (extArgs.idleAnim) {
      this.ensureHasAnimator()

      this.idleAnim = {
        clip: extArgs.idleAnim,
        playing: false,
        loop: true
      }
      const animator = Animator.getMutable(this.entity)
      animator.states = animator.states.concat(this.idleAnim)
      this.idleAnim.playing = true
    }

    if (extArgs.events) {
      this.events = extArgs.events
    }

    return this
  }
  ensureHasAnimator() {
    const animator = Animator.getMutableOrNull(this.entity)
    if (!animator) {
      Animator.create(this.entity, {
        states: []
      })
    }
  }
  isVisible() {
    return Vector3.equalsWithEpsilon(Transform.getMutable(this.entity).scale, Vector3.Zero())
  }
  appear() {
    Transform.getMutable(this.entity).scale = Vector3.clone(this.entityScale)
  }
  hide() {
    Transform.getMutable(this.entity).scale = Vector3.Zero()
  }
  /**
   * 
   * @param animationName 
   * @param noLoop 
   * @param duration 
   * @param speed 
   * @param interval 
   * @param resetAnim (optional; defaults:true) resets the animation before playing. if it was paused dont reset 
   *  makes sense to  only finish out the animation if anim loop=false and did not get to the end before next play 
   *  it will only finish  out the rest of the loop which could be .01 seconds or 5 seconds
   */
  playAnimation(
    animationName: string,
    noLoop?: boolean,
    duration?: number,
    speed?: number,
    interval?: number,
    resetAnim?: boolean
  ) {
    if (this.endAnimTimerId) {
      utils.timers.clearInterval(this.endAnimTimerId)
    }

    if (this.intervalAnimTimerId) {
      utils.timers.clearInterval(this.intervalAnimTimerId)
    }

    if (!this.isVisible()) {
      //TODO do we want this to auto show?
      this.appear()
    }

    this.ensureHasAnimator()
    const animator = Animator.getMutable(this.entity)

    let newAnim: PBAnimationState | null = null
    for (let state of animator.states) {
      if (state.clip == animationName) {
        newAnim = state
        break
      }
    }

    if (newAnim === undefined || newAnim === null) {
      newAnim = {
        clip: animationName,
        playing: false,
        loop: !noLoop
      }
      animator.states = animator.states.concat(newAnim)
    }

    const resetAnimation = resetAnim === undefined || resetAnim

    if (speed) {
      newAnim.speed = speed
    } else {
      newAnim.speed = 1
    }

    if (noLoop) {
      newAnim.loop = false
    } else {
      newAnim.loop = true
    }
    if (noLoop) {
      if (interval && duration) {
        playOnceAndIdle(this, newAnim, duration, resetAnimation)
        const self = this
        this.intervalAnimTimerId = utils.timers.setInterval(function () {
          if (newAnim) playOnceAndIdle(self, newAnim, duration)
        }, interval * 1000)
      } else if (duration) {
        // play once & idle
        if (newAnim) playOnceAndIdle(this, newAnim, duration, resetAnimation)
      } else {
        // play once and stay on last frame
        newAnim.loop = false
        Animator.playSingleAnimation(this.entity, animationName, resetAnimation)
      }
    } else {
      newAnim.loop = true
      Animator.playSingleAnimation(this.entity, animationName, resetAnimation)

      handlePlayDuration(this, duration)
    }
  }
  play(): void {
    this.playIdleAnimation()
  }
  stop(): void {
    this.stopAllAnimations()
  }
  playIdleAnimation() {
    if (this.idleAnim) {
      Animator.playSingleAnimation(this.entity, this.idleAnim.clip, true)
    }
  }
  setNewIdleAnim(animName: string) {
    this.stopAllAnimations()
    this.ensureHasAnimator()

    const animator = Animator.getMutable(this.entity)
    for (let state of animator.states) {
      if (state.clip == this.idleAnim?.clip) {
        state.clip = animName
        state.playing = false
        state.loop = true
      }
    }
    Animator.playSingleAnimation(this.entity, animName, true)
  }
  stopAllAnimations() {
    Animator.stopAllAnimations(this.entity)
  }
}

/**
 * 
 * @param ent 
 * @param anim 
 * @param duration 
 * @param resetAnim (optional; defaults:true)  resets the animation before playing. if it was paused dont reset makes sense to 
 *  only finish out the animation if anim loop=false and did not get to the end before next play it will only finish 
 *  out the rest of the loop which could be .01 seconds or 5 seconds
 */
export function playOnceAndIdle(
  ent: ShowEntityModel,
  anim: PBAnimationState,
  duration: number,
  resetAnim?: boolean
) {
  Animator.playSingleAnimation(ent.entity, anim.clip, resetAnim)
  handlePlayDuration(ent, duration)
}

function handlePlayDuration(ent: ShowEntityModel, duration?: number) {
  if (duration) {
    ent.endAnimTimerId = utils.timers.setTimeout(
      function () {
        if (ent.idleAnim) {
          Animator.playSingleAnimation(ent.entity, ent.idleAnim.clip, true)
        }
      },
      duration * 1000
    )
  }
}