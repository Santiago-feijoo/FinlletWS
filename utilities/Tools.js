const RequestModel = require("../models/RequestModel");

class Tools {
    /**
    * Valida el contenido de la solicitud sea válido para el proyecto.
    * @param {RequestModel} requestContent - Contenido de la solicitud.
    * @returns {boolean} Confirmación.
    */
    validateProjectRequest(requestContent) {
        return requestContent.projectName === "FinlletAPP";
    }
}

module.exports = Tools;