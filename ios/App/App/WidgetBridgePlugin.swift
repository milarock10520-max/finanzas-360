import Foundation
import Capacitor
import WidgetKit

// Puente app → widget: la web le pasa el resumen del día y se guarda en el App Group
// que lee la extensión FinanzasWidget.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "actualizar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "limpiar", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.finanzas360.app"
    static let clave = "resumen"

    @objc func actualizar(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("App Group no disponible")
            return
        }
        let resumen: [String: Any] = [
            "saldo": call.getDouble("saldo") ?? 0,
            "gastoHoy": call.getDouble("gastoHoy") ?? 0,
            "gastoMes": call.getDouble("gastoMes") ?? 0,
            "proximoPago": call.getString("proximoPago") ?? "",
            "actualizado": Date().timeIntervalSince1970
        ]
        defaults.set(resumen, forKey: Self.clave)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    // Al cerrar sesión: el widget deja de mostrar cifras.
    @objc func limpiar(_ call: CAPPluginCall) {
        UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.clave)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
