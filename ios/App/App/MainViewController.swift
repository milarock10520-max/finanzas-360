import UIKit
import Capacitor

// Controlador principal: registra los plugins propios de la app.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
