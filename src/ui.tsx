import { ShowHUD } from './showMgmt/showhud/ShowHUD'
import * as ui from 'dcl-ui-toolkit'

export const renderHUD = () => (
  [
    ui.render(),
    ShowHUD.render()
  ]
)