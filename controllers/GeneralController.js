const express = require('express');
const router = express.Router();
const database = require('../dbconfig');
const RequestModel = require('../models/RequestModel');
const Tools = require('../utilities/Tools');
const DocumentTypeModel = require('../models/DocumentTypeModel');
const RegisteredUserInformationModel = require('../models/RegisteredUserInformationModel');
const UserProfileModel = require('../models/UserProfileModel');
const RegisteredEstablishmentInformationModel = require('../models/RegisteredEstablishmentInformationModel');
const DailyBalanceModel = require('../models/DailyBalanceModel');
const QuotaAllocationModel = require('../models/QuotaAllocationModel');
const MotionModel = require('../models/MotionModel');
const RegisteredUserModel = require('../models/RegisteredUserModel');
const PaymentRegisteredModel = require('../models/PaymentRegisteredModel');
const ResponseDataListModel = require('../models/ResponseDataListModel');
const ResponseStatusModel = require('../models/ResponseStatusModel');
const ResponseModel = require('../models/ResponseModel');
const { format } = require('date-fns');
const bcrypt = require('bcrypt');
const TransactionModel = require('../models/TransactionModel');
const LoginModel = require('../models/LoginModel');
const RegisteredProfileModel = require('../models/RegisteredProfileModel');
const EconomicActivityModel = require('../models/EconomicActivityModel');

router.post("/v1/SendUserToRegister", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        await databaseConnection.query('BEGIN');
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const userToRegister = listOfData.userToRegister;

            const username = userToRegister.username;

            const saltOrRounds = await bcrypt.genSalt(8);
            const password = userToRegister.password;
            const encryptedPassword = await bcrypt.hash(password, saltOrRounds);

            const profileTypeId = userToRegister.profileTypeId;

            const userInsertResponse = await databaseConnection.query(`INSERT INTO public.users (username, "password") VALUES ('${username}', '${encryptedPassword}') RETURNING id`);
            
            if(userInsertResponse.rows.length > 0) {
                const userId = userInsertResponse.rows[0].id;
                const userProfileInsertResponse = await databaseConnection.query(`INSERT INTO public.user_profiles (user_id, profile_id) VALUES ('${userId}', '${profileTypeId}') RETURNING id`);

                if(userProfileInsertResponse.rows.length > 0) {
                    const userProfileId = userProfileInsertResponse.rows[0].id;
                    const userInformation = userToRegister.userInformation;

                    const userInformationInsertResponse = await databaseConnection.query(`INSERT INTO public.user_information (user_id, first_name, second_name, surname, second_surname, document_type_id, document_number, residence_department_id, city_of_residence_id, residence_neighborhood, residence_address, cellphone_number, email)
                        VALUES(${userId}, '${userInformation.firstName}', '${userInformation.secondName}', '${userInformation.surname}', '${userInformation.secondSurname}', ${userInformation.documentTypeId}, '${userInformation.documentNumber}', ${userInformation.residenceDepartmentId}, ${userInformation.cityOfResidenceId}, '${userInformation.residenceNeighborhood}', '${userInformation.residenceAddress}', '${userInformation.cellphoneNumber}', '${userInformation.email}') `);

                    if(userInformationInsertResponse.rowCount > 0) {
                        if(profileTypeId === 2) {
                            const establishmentInformation = userToRegister.establishmentInformation;

                            const establishmentInformationInsertionResponse = await databaseConnection.query(`INSERT INTO public.commercial_establishments (user_profile_id, "name", nit, economic_activity_id)
                                VALUES(${userProfileId}, '${establishmentInformation.name}', '${establishmentInformation.nit}', ${establishmentInformation.economicActivityId});`);

                            if(establishmentInformationInsertionResponse.rowCount > 0) {
                                const quotaResponseByProfile = await databaseConnection.query(`SELECT * FROM public.quota_per_profile WHERE profile_id = ${profileTypeId}`);

                                var initialBalance = 0;
                                const currentDateAndTime = new Date();
                                const dateAndTime = format(currentDateAndTime, 'yyyy-MM-dd HH:mm:ss');

                                if(quotaResponseByProfile.rows.length > 0) {
                                    initialBalance = quotaResponseByProfile.rows[0].value;

                                }

                                const dailyBalanceInsertionResponse = await databaseConnection.query(`INSERT INTO public.daily_balance (user_profile_id, initial_balance, final_balance, date_and_time)
                                    VALUES(${userProfileId}, ${initialBalance}, ${initialBalance}, '${dateAndTime}')`);

                                if(dailyBalanceInsertionResponse.rowCount > 0) {
                                    const quotaAllocationInsertionResponse = await databaseConnection.query(`INSERT INTO public.quota_allocation (user_profile_id, value)
                                        VALUES(${userProfileId}, ${initialBalance}) RETURNING id`);

                                    if(quotaAllocationInsertionResponse.rows.length > 0) {
                                        const movementId = quotaAllocationInsertionResponse.rows[0].id;

                                        const motionInsertionResponse = await databaseConnection.query(`INSERT INTO public.movements (user_profile_id, movement_id, movement_type_id, value, date_and_time)
                                            VALUES(${userProfileId}, ${movementId}, 1, ${initialBalance}, '${dateAndTime}')`);

                                        if(motionInsertionResponse.rowCount > 0) {
                                            const registeredUserResult = await databaseConnection.query(`SELECT * FROM public.users WHERE id = ${userId}`);
                                            const registeredUserInformationResult = await databaseConnection.query(`SELECT * FROM public.user_information WHERE user_id = ${userId}`);
                                            const resultOfRegisteredUserProfiles = await databaseConnection.query(`SELECT * FROM public.user_profiles WHERE user_id = ${userId}`);
                                            const establishmentInformationResult = await databaseConnection.query(`SELECT * FROM public.commercial_establishments WHERE user_profile_id = ${userProfileId}`);
                                            const dailyBalanceResultRecorded = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${userProfileId}`);
                                            const resultOfQuotaAllocations = await databaseConnection.query(`SELECT * FROM public.quota_allocation WHERE user_profile_id = ${userProfileId}`);
                                            const resultOfMovements = await databaseConnection.query(`SELECT * FROM public.movements WHERE user_profile_id = ${userProfileId}`);

                                            if(registeredUserResult.rows.length > 0 && registeredUserInformationResult.rows.length > 0 && resultOfRegisteredUserProfiles.rows.length > 0 && establishmentInformationResult.rows.length > 0 && dailyBalanceResultRecorded.rows.length > 0 && resultOfQuotaAllocations.rows.length > 0 && resultOfMovements.rows.length > 0) {
                                                const registeredUser = new RegisteredUserModel();
                                                registeredUser.userId = registeredUserResult.rows[0].id;
                                                registeredUser.username = registeredUserResult.rows[0].username;
                                                registeredUser.password = password;

                                                const userInformation = new RegisteredUserInformationModel();
                                                userInformation.userId = registeredUserInformationResult.rows[0].user_id;
                                                userInformation.firstName = registeredUserInformationResult.rows[0].first_name;
                                                userInformation.secondName = registeredUserInformationResult.rows[0].second_name;
                                                userInformation.surname = registeredUserInformationResult.rows[0].surname;
                                                userInformation.secondSurname = registeredUserInformationResult.rows[0].second_surname;
                                                userInformation.documentTypeId = registeredUserInformationResult.rows[0].document_type_id;
                                                userInformation.documentNumber = registeredUserInformationResult.rows[0].document_number;
                                                userInformation.residenceDepartmentId = registeredUserInformationResult.rows[0].residence_department_id;
                                                userInformation.cityOfResidenceId = registeredUserInformationResult.rows[0].city_of_residence_id;
                                                userInformation.residenceNeighborhood = registeredUserInformationResult.rows[0].residence_neighborhood;
                                                userInformation.residenceAddress = registeredUserInformationResult.rows[0].residence_address;
                                                userInformation.cellphoneNumber = registeredUserInformationResult.rows[0].cellphone_number;
                                                userInformation.email = registeredUserInformationResult.rows[0].email;

                                                registeredUser.userInformation = userInformation;

                                                const establishmentInformation = new RegisteredEstablishmentInformationModel();
                                                establishmentInformation.id = establishmentInformationResult.rows[0].id;
                                                establishmentInformation.name = establishmentInformationResult.rows[0].name;
                                                establishmentInformation.nit = establishmentInformationResult.rows[0].nit;
                                                establishmentInformation.economicActivityId = establishmentInformationResult.rows[0].economic_activity_id;
                                                establishmentInformation.userProfileId = establishmentInformationResult.rows[0].user_profile_id;

                                                registeredUser.establishmentInformation = establishmentInformation;

                                                const userProfile = new UserProfileModel()
                                                userProfile.id = resultOfRegisteredUserProfiles.rows[0].id;
                                                userProfile.userId = resultOfRegisteredUserProfiles.rows[0].user_id;
                                                userProfile.profileId = resultOfRegisteredUserProfiles.rows[0].profile_id;

                                                registeredUser.userProfile = userProfile;

                                                const dailyBalance = new DailyBalanceModel()
                                                dailyBalance.id = dailyBalanceResultRecorded.rows[0].id;
                                                dailyBalance.userProfileId = dailyBalanceResultRecorded.rows[0].user_profile_id;
                                                dailyBalance.initialBalance = dailyBalanceResultRecorded.rows[0].initial_balance;
                                                dailyBalance.finalBalance = dailyBalanceResultRecorded.rows[0].final_balance;
                                                dailyBalance.dateAndTime = dailyBalanceResultRecorded.rows[0].date_and_time;

                                                registeredUser.dailyBalance = dailyBalance;

                                                const quotaAllocation = new QuotaAllocationModel()
                                                quotaAllocation.userProfileId = resultOfQuotaAllocations.rows[0].user_profile_id;
                                                quotaAllocation.value = resultOfQuotaAllocations.rows[0].value;

                                                registeredUser.quotaAllocation = quotaAllocation;

                                                /** 
                                                * @type {Array<MotionModel>} 
                                                */
                                                const listOfMovements = [];

                                                resultOfMovements.rows.forEach(motion => {
                                                    const newMovement = new MotionModel()
                                                    newMovement.id = motion.id;
                                                    newMovement.userProfileId = motion.user_profile_id;
                                                    newMovement.movementId = motion.movement_id;
                                                    newMovement.movementTypeId = motion.movement_type_id;
                                                    newMovement.description = motion.description;
                                                    newMovement.value = motion.value;
                                                    newMovement.dateAndTime = motion.date_and_time;

                                                    listOfMovements.push(newMovement);

                                                });

                                                registeredUser.listOfMovements = listOfMovements;

                                                const listOfData = new ResponseDataListModel();
                                                listOfData.registeredUserInformation = registeredUser;

                                                responseContent.listOfData = listOfData;

                                                responseStatus.state = true;
                                                responseStatus.statusCode = 200;
                                                responseStatus.statusMessage = "Inserción ejecutada correctamente.";

                                                await databaseConnection.query('COMMIT');

                                            } else {
                                                await databaseConnection.query('ROLLBACK');
                                                
                                                responseStatus.state = false;
                                                responseStatus.statusCode = 0;
                                                responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                            }

                                        } else {
                                            await databaseConnection.query('ROLLBACK');

                                            responseStatus.state = false;
                                            responseStatus.statusCode = 0;
                                            responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                        }

                                    } else {
                                        await databaseConnection.query('ROLLBACK');

                                        responseStatus.state = false;
                                        responseStatus.statusCode = 0;
                                        responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                    }

                                } else {
                                    await databaseConnection.query('ROLLBACK');

                                    responseStatus.state = false;
                                    responseStatus.statusCode = 0;
                                    responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                }


                            } else {
                                await databaseConnection.query('ROLLBACK');

                                responseStatus.state = false;
                                responseStatus.statusCode = 0;
                                responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                            }

                        } else {
                            const quotaResponseByProfile = await databaseConnection.query(`SELECT * FROM public.quota_per_profile WHERE profile_id = ${profileTypeId}`);

                            var initialBalance = 0;
                            const currentDateAndTime = new Date();
                            const dateAndTime = format(currentDateAndTime, 'yyyy-MM-dd HH:mm:ss');

                            if(quotaResponseByProfile.rows.length > 0) {
                                initialBalance = quotaResponseByProfile.rows[0].value;

                            }

                            const dailyBalanceInsertionResponse = await databaseConnection.query(`INSERT INTO public.daily_balance (user_profile_id, initial_balance, final_balance, date_and_time)
                                VALUES(${userProfileId}, ${initialBalance}, ${initialBalance}, '${dateAndTime}')`);

                            if(dailyBalanceInsertionResponse.rowCount > 0) {
                                const quotaAllocationInsertionResponse = await databaseConnection.query(`INSERT INTO public.quota_allocation (user_profile_id, value)
                                    VALUES(${userProfileId}, ${initialBalance}) RETURNING id`);

                                if(quotaAllocationInsertionResponse.rows.length > 0) {
                                    const movementId = quotaAllocationInsertionResponse.rows[0].id;

                                    const motionInsertionResponse = await databaseConnection.query(`INSERT INTO public.movements (user_profile_id, movement_id, movement_type_id, value, date_and_time)
                                        VALUES(${userProfileId}, ${movementId}, 1, ${initialBalance}, '${dateAndTime}')`);

                                    if(motionInsertionResponse.rowCount > 0) {
                                        const registeredUserResult = await databaseConnection.query(`SELECT * FROM public.users WHERE id = ${userId}`);
                                        const registeredUserInformationResult = await databaseConnection.query(`SELECT * FROM public.user_information WHERE user_id = ${userId}`);
                                        const resultOfRegisteredUserProfiles = await databaseConnection.query(`SELECT * FROM public.user_profiles WHERE user_id = ${userId}`);
                                        const dailyBalanceResultRecorded = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${userProfileId}`);
                                        const resultOfQuotaAllocations = await databaseConnection.query(`SELECT * FROM public.quota_allocation WHERE user_profile_id = ${userProfileId}`);
                                        const resultOfMovements = await databaseConnection.query(`SELECT * FROM public.movements WHERE user_profile_id = ${userProfileId}`);

                                        if(registeredUserResult.rows.length > 0 && registeredUserInformationResult.rows.length > 0 && resultOfRegisteredUserProfiles.rows.length > 0 && dailyBalanceResultRecorded.rows.length > 0 && resultOfQuotaAllocations.rows.length > 0 && resultOfMovements.rows.length > 0) {
                                            const registeredUser = new RegisteredUserModel();
                                            registeredUser.userId = registeredUserResult.rows[0].id;
                                            registeredUser.username = registeredUserResult.rows[0].username;
                                            registeredUser.password = password;

                                            const userInformation = new RegisteredUserInformationModel();
                                            userInformation.userId = registeredUserInformationResult.rows[0].user_id;
                                            userInformation.firstName = registeredUserInformationResult.rows[0].first_name;
                                            userInformation.secondName = registeredUserInformationResult.rows[0].second_name;
                                            userInformation.surname = registeredUserInformationResult.rows[0].surname;
                                            userInformation.secondSurname = registeredUserInformationResult.rows[0].second_surname;
                                            userInformation.documentTypeId = registeredUserInformationResult.rows[0].document_type_id;
                                            userInformation.documentNumber = registeredUserInformationResult.rows[0].document_number;
                                            userInformation.residenceDepartmentId = registeredUserInformationResult.rows[0].residence_department_id;
                                            userInformation.cityOfResidenceId = registeredUserInformationResult.rows[0].city_of_residence_id;
                                            userInformation.residenceNeighborhood = registeredUserInformationResult.rows[0].residence_neighborhood;
                                            userInformation.residenceAddress = registeredUserInformationResult.rows[0].residence_address;
                                            userInformation.cellphoneNumber = registeredUserInformationResult.rows[0].cellphone_number;
                                            userInformation.email = registeredUserInformationResult.rows[0].email;

                                            registeredUser.userInformation = userInformation;

                                            const userProfile = new UserProfileModel()
                                            userProfile.id = resultOfRegisteredUserProfiles.rows[0].id;
                                            userProfile.userId = resultOfRegisteredUserProfiles.rows[0].user_id;
                                            userProfile.profileId = resultOfRegisteredUserProfiles.rows[0].profile_id;

                                            registeredUser.userProfile = userProfile;

                                            const dailyBalance = new DailyBalanceModel()
                                            dailyBalance.id = dailyBalanceResultRecorded.rows[0].id;
                                            dailyBalance.userProfileId = dailyBalanceResultRecorded.rows[0].user_profile_id;
                                            dailyBalance.initialBalance = dailyBalanceResultRecorded.rows[0].initial_balance;
                                            dailyBalance.finalBalance = dailyBalanceResultRecorded.rows[0].final_balance;
                                            dailyBalance.dateAndTime = dailyBalanceResultRecorded.rows[0].date_and_time;

                                            registeredUser.dailyBalance = dailyBalance;

                                            const quotaAllocation = new QuotaAllocationModel()
                                            quotaAllocation.userProfileId = resultOfQuotaAllocations.rows[0].user_profile_id;
                                            quotaAllocation.value = resultOfQuotaAllocations.rows[0].value;

                                            registeredUser.quotaAllocation = quotaAllocation;

                                            /** 
                                            * @type {Array<MotionModel>} 
                                            */
                                            const listOfMovements = [];

                                            resultOfMovements.rows.forEach(motion => {
                                                const newMovement = new MotionModel()
                                                newMovement.id = motion.id;
                                                newMovement.userProfileId = motion.user_profile_id;
                                                newMovement.movementId = motion.movement_id;
                                                newMovement.movementTypeId = motion.movement_type_id;
                                                newMovement.description = motion.description;
                                                newMovement.value = motion.value;
                                                newMovement.dateAndTime = motion.date_and_time;

                                                listOfMovements.push(newMovement);

                                            });

                                            registeredUser.listOfMovements = listOfMovements;

                                            const listOfData = new ResponseDataListModel()
                                            listOfData.registeredUserInformation = registeredUser

                                            responseContent.listOfData = listOfData

                                            responseStatus.state = true;
                                            responseStatus.statusCode = 200;
                                            responseStatus.statusMessage = "Inserción ejecutada correctamente.";

                                            await databaseConnection.query('COMMIT');

                                        } else {
                                            await databaseConnection.query('ROLLBACK');
                                            
                                            responseStatus.state = false;
                                            responseStatus.statusCode = 0;
                                            responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                        }

                                    } else {
                                        await databaseConnection.query('ROLLBACK');

                                        responseStatus.state = false;
                                        responseStatus.statusCode = 0;
                                        responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                    }

                                } else {
                                    await databaseConnection.query('ROLLBACK');

                                    responseStatus.state = false;
                                    responseStatus.statusCode = 0;
                                    responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                }

                            } else {
                                await databaseConnection.query('ROLLBACK');

                                responseStatus.state = false;
                                responseStatus.statusCode = 0;
                                responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                            }

                        }

                    } else {
                        await databaseConnection.query('ROLLBACK');

                        responseStatus.state = false;
                        responseStatus.statusCode = 0;
                        responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                    }

                } else {
                    await databaseConnection.query('ROLLBACK');

                    responseStatus.state = false;
                    responseStatus.statusCode = 0;
                    responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                }

            } else {
                await databaseConnection.query('ROLLBACK');

                responseStatus.state = false;
                responseStatus.statusCode = 0;
                responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

            }

        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'SendUserToRegister', now())`);

        response.json(responseContent);

    } catch(error) {
        await databaseConnection.query('ROLLBACK');
        response.status(500).send(error.stack);

    } finally {
        databaseConnection.release();

    }

});

router.post("/v1/ValidateUserInformationToRegister", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const userToRegister = listOfData.userToRegister;
            const userInformation = userToRegister.userInformation;

            const documentNumber = userInformation.documentNumber;
            const cellphoneNumber = userInformation.cellphoneNumber
            const email = userInformation.email;

            const existingDocumentNumberResult = await databaseConnection.query(`SELECT * FROM public.users AS u INNER JOIN public.user_information AS ui ON u.id = ui.user_id WHERE ui.document_number = '${documentNumber}'`);
        
            if(existingDocumentNumberResult.rows.length > 0) {
                responseStatus.state = false;
                responseStatus.statusCode = 0;
                responseStatus.statusMessage = "El número de documento ya existe.";
    
            } else {
                const existingCellphoneNumberResult = await databaseConnection.query(`SELECT * FROM public.users AS u INNER JOIN public.user_information AS ui ON u.id = ui.user_id WHERE ui.cellphone_number = '${cellphoneNumber}'`);

                if(existingCellphoneNumberResult.rows.length > 0) {
                    responseStatus.state = false;
                    responseStatus.statusCode = 0;
                    responseStatus.statusMessage = "El número de teléfono celular ya existe.";
        
                } else {
                    const existingEmailResult = await databaseConnection.query(`SELECT * FROM public.users AS u INNER JOIN public.user_information AS ui ON u.id = ui.user_id WHERE LOWER(ui.email) = LOWER('${email}')`);

                    if(existingEmailResult.rows.length > 0) {
                        responseStatus.state = false;
                        responseStatus.statusCode = 0;
                        responseStatus.statusMessage = "El correo electrónico ya existe.";
            
                    } else {
                        responseStatus.state = true;
                        responseStatus.statusCode = 200;
                        responseStatus.statusMessage = "La información de usuario a registrar no existe.";

                    }

                }

            }

        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'ValidateUserInformationToRegister', now())`);

        response.json(responseContent);

    } catch(error) {
        response.status(500).send("Error: " +error.stack);

    } finally {
        databaseConnection.release();

    }

});

router.post("/v1/GetDocumentTypes", async(request, response) => {
    const databaseConnection = await database();

    try {
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateProjectRequest(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const [documentTypes] = await databaseConnection.query(`SELECT * FROM DocumentTypes order by DocumentTypeId asc`);

            /** 
            * @type {Array<DocumenTypeModel>} 
            */
            const listOfDocumentTypes = [];

            if(documentTypes.length > 0) {
                documentTypes.forEach(documentType => {
                    const newDocumentType = new DocumentTypeModel()
                    newDocumentType.documentTypeId = documentType.DocumentTypeId;
                    newDocumentType.documentTypeName = documentType.DocumentTypeName;
                    newDocumentType.acronym = documentType.Acronym;

                    listOfDocumentTypes.push(newDocumentType);
                });
            }

            const responseDataList = new ResponseDataListModel();
            responseDataList.documentTypes = listOfDocumentTypes;
            responseContent.listOfData = responseDataList;

            responseStatus.state = true;
            responseStatus.statusCode = 200;
            responseStatus.statusMessage = "Consulta ejecutada correctamente.";
        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";
        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO WebServicesLog (RequestJson, ResponseJson, EndPoint, DateAndTime)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'GetDocumentTypes', now())`);

        response.json(responseContent);
    } catch(error) {
        response.status(500).send("Error: " +error.stack);
    } finally {
        databaseConnection.end();
    }
});

router.post("/v1/Login", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const accessInformation = listOfData.accessInformation;

            const username = accessInformation.username;
            const password = accessInformation.password;

            const registeredUserResult = await databaseConnection.query(`SELECT * FROM public.users as u INNER JOIN public.user_information as ui ON u.id = ui.user_id WHERE u.username = '${username}' or ui.document_number = '${username}' or ui.cellphone_number = '${username}' or ui.email = '${username}'`);
        
            if(registeredUserResult.rows.length > 0) {
                const encryptedPassword = registeredUserResult.rows[0].password;
                const validPassword = await bcrypt.compare(password, encryptedPassword)
                
                if(validPassword) {
                    const userId = registeredUserResult.rows[0].id;

                    const login = new LoginModel();
                    login.userId = registeredUserResult.rows[0].id;
                    login.username = registeredUserResult.rows[0].username;
                    login.password = password;

                    const userInformation = new RegisteredUserInformationModel();
                    userInformation.userId = registeredUserResult.rows[0].user_id;
                    userInformation.firstName = registeredUserResult.rows[0].first_name;
                    userInformation.secondName = registeredUserResult.rows[0].second_name;
                    userInformation.surname = registeredUserResult.rows[0].surname;
                    userInformation.secondSurname = registeredUserResult.rows[0].second_surname;
                    userInformation.documentTypeId = registeredUserResult.rows[0].document_type_id;
                    userInformation.documentNumber = registeredUserResult.rows[0].document_number;
                    userInformation.residenceDepartmentId = registeredUserResult.rows[0].residence_department_id;
                    userInformation.cityOfResidenceId = registeredUserResult.rows[0].city_of_residence_id;
                    userInformation.residenceNeighborhood = registeredUserResult.rows[0].residence_neighborhood;
                    userInformation.residenceAddress = registeredUserResult.rows[0].residence_address;
                    userInformation.cellphoneNumber = registeredUserResult.rows[0].cellphone_number;
                    userInformation.email = registeredUserResult.rows[0].email;

                    login.userInformation = userInformation;

                    const resultOfRegisteredUserProfiles = await databaseConnection.query(`SELECT * FROM public.user_profiles WHERE user_id = ${userId}`);

                    if(resultOfRegisteredUserProfiles.rows.length > 0) {
                        /** 
                        * @type {Array<UserProfileModel>} 
                        */
                        const listOfUserProfiles = [];

                        /** 
                        * @type {boolean} 
                        */
                        var hasAnEstablishmentProfile = false;

                        resultOfRegisteredUserProfiles.rows.forEach(userProfile => {
                            const newUserProfile = new UserProfileModel()
                            newUserProfile.id = userProfile.id;
                            newUserProfile.userId = userProfile.user_id;
                            newUserProfile.profileId = userProfile.profile_id;

                            listOfUserProfiles.push(newUserProfile);

                            if(userProfile.profile_id == 2) {
                                hasAnEstablishmentProfile = true;

                            }

                        });

                        login.listOfUserProfiles = listOfUserProfiles;

                        if(hasAnEstablishmentProfile) {
                            const establishmentInformationResult = await databaseConnection.query(`SELECT ce.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON u.id = up.user_id INNER JOIN public.commercial_establishments as ce on up.id = ce.user_profile_id WHERE u.id = ${userId}`);

                            if(establishmentInformationResult.rows.length > 0) {
                                const establishmentInformation = new RegisteredEstablishmentInformationModel();
                                establishmentInformation.id = establishmentInformationResult.rows[0].id;
                                establishmentInformation.name = establishmentInformationResult.rows[0].name;
                                establishmentInformation.nit = establishmentInformationResult.rows[0].nit;
                                establishmentInformation.economicActivityId = establishmentInformationResult.rows[0].economic_activity_id;
                                establishmentInformation.userProfileId = establishmentInformationResult.rows[0].user_profile_id;

                                login.establishmentInformation = establishmentInformation;

                            }

                        }

                        const resultOfDailyRecordedBalances = await databaseConnection.query(`SELECT db.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON u.id = up.user_id INNER JOIN public.daily_balance AS db ON up.id = db.user_profile_id WHERE u.id = ${userId} ORDER BY DATE(db.date_and_time) DESC`);

                        if(resultOfDailyRecordedBalances.rows.length > 0) {
                            /** 
                            * @type {Array<DailyBalanceModel>} 
                            */
                            const listOfDailyBalances = [];

                            resultOfDailyRecordedBalances.rows.forEach(dailyBalance => {
                                const newDailyBalance = new DailyBalanceModel()
                                newDailyBalance.id = dailyBalance.id;
                                newDailyBalance.userProfileId = dailyBalance.user_profile_id;
                                newDailyBalance.initialBalance = dailyBalance.initial_balance;
                                newDailyBalance.finalBalance = dailyBalance.final_balance;
                                newDailyBalance.dateAndTime = dailyBalance.date_and_time; 

                                listOfDailyBalances.push(newDailyBalance);

                            });
                               
                            login.listOfDailyBalances = listOfDailyBalances;

                            const resultOfQuotaAllocations = await databaseConnection.query(`SELECT qa.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON u.id = up.user_id INNER JOIN public.quota_allocation AS qa ON up.id = qa.user_profile_id WHERE u.id = ${userId}`);

                            if(resultOfQuotaAllocations.rows.length > 0) {
                                /** 
                                * @type {Array<QuotaAllocationModel>} 
                                */
                                const listOfQuotaAssignments = [];

                                resultOfQuotaAllocations.rows.forEach(quotaAllocation => {
                                    const newQuotaAllocation = new QuotaAllocationModel()
                                    newQuotaAllocation.userProfileId = quotaAllocation.user_profile_id;
                                    newQuotaAllocation.value = quotaAllocation.value;

                                    listOfQuotaAssignments.push(newQuotaAllocation);

                                });

                                login.listOfQuotaAssignments = listOfQuotaAssignments;

                                const transactionResults = await databaseConnection.query(`SELECT t.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON u.id = up.user_id INNER JOIN public.transactions AS t ON up.id = t.user_profile_id WHERE u.id = ${userId}`);

                                /** 
                                * @type {Array<TransactionModel>} 
                                */
                                const listOfTransactions = [];

                                if(transactionResults.rows.length > 0) {
                                    transactionResults.rows.forEach(transaction => {
                                        const newTransaction = new TransactionModel()
                                        newTransaction.id = transaction.id;
                                        newTransaction.sourceUserProfileId = transaction.source_user_profile_id;
                                        newTransaction.targetUserProfileId = transaction.target_user_profile_id;
                                        newTransaction.value = transaction.value;
                                        newTransaction.dateAndTime = transaction.date_and_time;
                                        newTransaction.userProfileId = transaction.user_profile_id;
    
                                        listOfTransactions.push(newTransaction);
    
                                    });
                                
                                }

                                login.listOfTransactions = listOfTransactions;

                                const resultOfMovements = await databaseConnection.query(`SELECT m.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON u.id = up.user_id INNER JOIN public.movements AS m ON up.id = m.user_profile_id WHERE u.id = ${userId}`);

                                if(resultOfMovements.rows.length > 0) {
                                    /** 
                                    * @type {Array<MotionModel>} 
                                    */
                                    const listOfMovements = [];

                                    resultOfMovements.rows.forEach(motion => {
                                        const newMovement = new MotionModel()
                                        newMovement.id = motion.id;
                                        newMovement.userProfileId = motion.user_profile_id;
                                        newMovement.movementId = motion.movement_id;
                                        newMovement.movementTypeId = motion.movement_type_id;
                                        newMovement.description = motion.description;
                                        newMovement.value = motion.value;
                                        newMovement.dateAndTime = motion.date_and_time;

                                        listOfMovements.push(newMovement);

                                    });

                                    login.listOfMovements = listOfMovements;

                                    const listOfData = new ResponseDataListModel()
                                    listOfData.login = login
    
                                    responseContent.listOfData = listOfData;
    
                                    responseStatus.state = true;
                                    responseStatus.statusCode = 200;
                                    responseStatus.statusMessage = "Consulta ejecutada correctamente.";

                                } else {
                                    responseStatus.state = false;
                                    responseStatus.statusCode = 0;
                                    responseStatus.statusMessage = "No se pudo obtener la información del usuario, intente nuevamente.";

                                }

                            } else {
                                responseStatus.state = false;
                                responseStatus.statusCode = 0;
                                responseStatus.statusMessage = "No se pudo obtener la información del usuario, intente nuevamente.";

                            }

                        } else {
                            responseStatus.state = false;
                            responseStatus.statusCode = 0;
                            responseStatus.statusMessage = "No se pudo obtener la información del usuario, intente nuevamente.";

                        }

                    } else {
                        responseStatus.state = false;
                        responseStatus.statusCode = 0;
                        responseStatus.statusMessage = "No se pudo obtener la información del usuario, intente nuevamente.";

                    }

                } else {
                    responseStatus.state = false;
                    responseStatus.statusCode = 0;
                    responseStatus.statusMessage = "Contraseña incorrecta.";

                }
    
            } else {
                responseStatus.state = false;
                responseStatus.statusCode = 0;
                responseStatus.statusMessage = "Nombre de usuario incorrecto.";

            }

        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'Login', now())`);

        response.json(responseContent);

    } catch(error) {
        response.status(500).send("Error: " +error.stack);

    } finally {
        databaseConnection.release();

    }

});

router.post("/v1/GetUserMovements", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const downloadInformation = listOfData.downloadInformation;
            const userId = downloadInformation.userId;
            const userProfileId = downloadInformation.userProfileId;

            const UserTransactionResults = await databaseConnection.query(`SELECT t.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON U.id = UP.user_id INNER JOIN public.transactions AS t ON up.id = t.user_profile_id WHERE u.id = ${userId}`);
            const userMovementResult = await databaseConnection.query(`SELECT m.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON U.id = UP.user_id INNER JOIN public.movements AS m ON up.id = m.user_profile_id WHERE u.id = ${userId}`);
            const userDailyBalanceResult = await databaseConnection.query(`SELECT db.* FROM public.users AS u INNER JOIN public.user_profiles AS up ON U.id = UP.user_id INNER JOIN public.daily_balance AS db ON up.id = db.user_profile_id WHERE up.id = ${userProfileId} AND CAST(date_and_time as date) = now()::date`);
    
            const responseDataList = new ResponseDataListModel();

            /** 
            * @type {Array<TransactionModel>} 
            */
            const listOfTransactions = [];

            /** 
            * @type {Array<MotionModel>} 
            */
            const listOfMovements = [];

            if(UserTransactionResults.rows.length > 0) {
                UserTransactionResults.rows.forEach(transaction => {
                    const newTransaction = new TransactionModel()
                    newTransaction.id = transaction.id;
                    newTransaction.sourceUserProfileId = transaction.source_user_profile_id;
                    newTransaction.targetUserProfileId = transaction.target_user_profile_id;
                    newTransaction.value = transaction.value;
                    newTransaction.dateAndTime = transaction.date_and_time;
                    newTransaction.userProfileId = transaction.user_profile_id;

                    listOfTransactions.push(newTransaction);

                });
    
            }

            if(userMovementResult.rows.length > 0) {
                userMovementResult.rows.forEach(motion => {
                    const newMovement = new MotionModel()
                    newMovement.id = motion.id;
                    newMovement.userProfileId = motion.user_profile_id;
                    newMovement.movementId = motion.movement_id;
                    newMovement.movementTypeId = motion.movement_type_id;
                    newMovement.description = motion.description;
                    newMovement.value = motion.value;
                    newMovement.dateAndTime = motion.date_and_time;

                    listOfMovements.push(newMovement);

                });
    
            }

            if(userDailyBalanceResult.rows.length > 0) {
                const dailyBalance = new DailyBalanceModel()
                dailyBalance.id = userDailyBalanceResult.rows[0].id;
                dailyBalance.userProfileId = userDailyBalanceResult.rows[0].user_profile_id;
                dailyBalance.initialBalance = userDailyBalanceResult.rows[0].initial_balance;
                dailyBalance.finalBalance = userDailyBalanceResult.rows[0].final_balance;
                dailyBalance.dateAndTime = userDailyBalanceResult.rows[0].date_and_time;

                responseDataList.dailyBalance = dailyBalance;
    
            }

            responseDataList.listOfTransactions = listOfTransactions;
            responseDataList.listOfMovements = listOfMovements;
            responseContent.listOfData = responseDataList;

            responseStatus.state = true;
            responseStatus.statusCode = 200;
            responseStatus.statusMessage = "Consulta ejecutada correctamente.";

        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'GetUserMovements', now())`);

        response.json(responseContent);

    } catch(error) {
        response.status(500).send("Error: " +error.stack);

    } finally {
        databaseConnection.release();

    }

});

router.post("/v1/GetEstablishmentInformationByEstablishmentCode", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const establishmentCode = listOfData.establishmentCode;

            const validCommercialEstablishmentCode = tools.validateTheCodeOfTheCommercialEstablishment(establishmentCode);

            if(validCommercialEstablishmentCode) {
                const establishmentId = establishmentCode.replace("MQ-C", "");
                const result = await databaseConnection.query('SELECT * FROM public.commercial_establishments WHERE id = ' +establishmentId);
        
                const listOfData = new ResponseDataListModel();
        
                if(result.rows.length > 0) {
                    const commercialEstablishment = new RegisteredEstablishmentInformationModel();
                    commercialEstablishment.id = result.rows[0].id;
                    commercialEstablishment.name = result.rows[0].name;
                    commercialEstablishment.nit = result.rows[0].nit;
                    commercialEstablishment.economicActivityId = result.rows[0].economic_activity_id;
                    commercialEstablishment.userProfileId = result.rows[0].user_profile_id;

                    listOfData.establishmentInformation = commercialEstablishment;
        
                }

                responseContent.listOfData = listOfData;

                responseStatus.state = true;
                responseStatus.statusCode = 200;
                responseStatus.statusMessage = "Consulta ejecutada correctamente.";

            } else {
                responseStatus.state = false;
                responseStatus.statusCode = 0;
                responseStatus.statusMessage = "Código de establecimiento inválido.";
    
            }

        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'GetEstablishmentInformationByEstablishmentCode', now())`);

        response.json(responseContent);

    } catch(error) {
        response.status(500).send("Error: " +error.stack);

    } finally {
        databaseConnection.release();

    }

});

router.post("/v1/SendPaymentToEstablishment", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        await databaseConnection.query('BEGIN');
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        const dateAndTime = new Date();
        const dateAndTimeWithFormat = format(dateAndTime, 'yyyy-MM-dd HH:mm:ss');

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const paymenToBeRegistered = listOfData.paymenToBeRegistered;

            const sourceUserProfileId = paymenToBeRegistered.sourceUserProfileId;
            const value = paymenToBeRegistered.value;
            const targetUserProfileId = paymenToBeRegistered.targetUserProfileId;

            const dailyBalanceOfOrigin = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${sourceUserProfileId}`);

            if(dailyBalanceOfOrigin.rows.length > 0) {
                const finalBalance = dailyBalanceOfOrigin.rows[0].final_balance;
                
                if(value <= finalBalance) {
                    const balanceUpdateResult = await databaseConnection.query(`UPDATE public.daily_balance SET final_balance = final_balance - ${value} WHERE user_profile_id = ${sourceUserProfileId} RETURNING *`);

                    if(balanceUpdateResult.rowCount !== 0) {
                        const dailyTargetBalance = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${targetUserProfileId}`);

                        if(dailyTargetBalance.rows.length > 0) {
                            const balanceUpdateResult = await databaseConnection.query(`UPDATE public.daily_balance SET final_balance = final_balance + ${value} WHERE user_profile_id = ${targetUserProfileId} RETURNING *`);

                            if(balanceUpdateResult.rowCount !== 0) {
                                const sourceTransactionPushResponse = await databaseConnection.query(`INSERT INTO public.transactions (source_user_profile_id, target_user_profile_id, value, date_and_time, user_profile_id)
                                    VALUES(${sourceUserProfileId}, ${targetUserProfileId}, ${value}, '${dateAndTimeWithFormat}', ${sourceUserProfileId}) RETURNING id`);

                                if(sourceTransactionPushResponse.rows.length > 0) {
                                    const originatingTransactionId = sourceTransactionPushResponse.rows[0].id;

                                    const originMotionInsertionResponse = await databaseConnection.query(`INSERT INTO public.movements (user_profile_id, movement_id, movement_type_id, value, date_and_time)
                                        VALUES(${sourceUserProfileId}, ${originatingTransactionId}, 2, ${value}, '${dateAndTimeWithFormat}') RETURNING id`);

                                    if(originMotionInsertionResponse.rows.length > 0) {
                                        const originMovementId = originMotionInsertionResponse.rows[0].id;

                                        const targetTransactionInsertResponse = await databaseConnection.query(`INSERT INTO public.transactions (source_user_profile_id, target_user_profile_id, value, date_and_time, user_profile_id)
                                            VALUES(${sourceUserProfileId}, ${targetUserProfileId}, ${value}, '${dateAndTimeWithFormat}', ${targetUserProfileId}) RETURNING id`);

                                        if(targetTransactionInsertResponse.rows.length > 0) {
                                            const targetTransactionId = targetTransactionInsertResponse.rows[0].id;

                                            const targetMotionInsertionResponse = await databaseConnection.query(`INSERT INTO public.movements (user_profile_id, movement_id, movement_type_id, value, date_and_time)
                                                VALUES(${targetUserProfileId}, ${targetTransactionId}, 3, ${value}, '${dateAndTimeWithFormat}') RETURNING id`);

                                            if(targetMotionInsertionResponse.rows.length > 0) {
                                                const targetMovementId = targetMotionInsertionResponse.rows[0].id;

                                                const dailyBalanceOfOrigin = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${sourceUserProfileId}`);
                                                const movementOfOrigin = await databaseConnection.query(`SELECT * FROM public.movements WHERE user_profile_id = ${sourceUserProfileId} AND id = ${originMovementId}`);
                                                const originatingTransaction = await databaseConnection.query(`SELECT * FROM public.transactions WHERE user_profile_id = ${sourceUserProfileId} AND id = ${originatingTransactionId}`);

                                                if(dailyBalanceOfOrigin.rows.length > 0 && movementOfOrigin.rows.length > 0 && originatingTransaction.rows.length > 0) {
                                                    const dailyBalance = new DailyBalanceModel();
                                                    dailyBalance.id = dailyBalanceOfOrigin.rows[0].id;
                                                    dailyBalance.userProfileId = dailyBalanceOfOrigin.rows[0].user_profile_id;
                                                    dailyBalance.initialBalance = dailyBalanceOfOrigin.rows[0].initial_balance;
                                                    dailyBalance.finalBalance = dailyBalanceOfOrigin.rows[0].final_balance;
                                                    dailyBalance.dateAndTime = dailyBalanceOfOrigin.rows[0].date_and_time;    

                                                    const movement = new MotionModel();
                                                    movement.id = movementOfOrigin.rows[0].id;
                                                    movement.userProfileId = movementOfOrigin.rows[0].user_profile_id;
                                                    movement.movementId = movementOfOrigin.rows[0].movement_id;
                                                    movement.movementTypeId = movementOfOrigin.rows[0].movement_type_id;
                                                    movement.description = movementOfOrigin.rows[0].description;
                                                    movement.value = movementOfOrigin.rows[0].value;
                                                    movement.dateAndTime = movementOfOrigin.rows[0].date_and_time;

                                                    const transaction = new TransactionModel();
                                                    transaction.id = originatingTransaction.rows[0].id;
                                                    transaction.sourceUserProfileId = originatingTransaction.rows[0].source_user_profile_id;
                                                    transaction.targetUserProfileId = originatingTransaction.rows[0].target_user_profile_id;
                                                    transaction.value = originatingTransaction.rows[0].value;
                                                    transaction.dateAndTime = originatingTransaction.rows[0].date_and_time;
                                                    transaction.userProfileId = originatingTransaction.rows[0].user_profile_id;

                                                    const paymentRegistered = new PaymentRegisteredModel();
                                                    paymentRegistered.dailyBalance = dailyBalance;
                                                    paymentRegistered.movement = movement;
                                                    paymentRegistered.transaction = transaction;

                                                    const listOfData = new ResponseDataListModel();
                                                    listOfData.paymentRegistered = paymentRegistered;

                                                    responseContent.listOfData = listOfData;

                                                    responseStatus.state = true;
                                                    responseStatus.statusCode = 200;
                                                    responseStatus.statusMessage = "Actualización ejecutada correctamente.";

                                                    await databaseConnection.query('COMMIT');

                                                } else {
                                                    await databaseConnection.query('ROLLBACK');

                                                    responseStatus.state = false;
                                                    responseStatus.statusCode = 0;
                                                    responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                                                }

                                            } else {
                                                await databaseConnection.query('ROLLBACK');

                                                responseStatus.state = false;
                                                responseStatus.statusCode = 0;
                                                responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                                            }

                                        } else {
                                            await databaseConnection.query('ROLLBACK');

                                            responseStatus.state = false;
                                            responseStatus.statusCode = 0;
                                            responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                                        }

                                    } else {
                                        await databaseConnection.query('ROLLBACK');

                                        responseStatus.state = false;
                                        responseStatus.statusCode = 0;
                                        responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                                    }

                                } else {
                                    await databaseConnection.query('ROLLBACK');

                                    responseStatus.state = false;
                                    responseStatus.statusCode = 0;
                                    responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                                }
                                
                            } else {
                                await databaseConnection.query('ROLLBACK');

                                responseStatus.state = false;
                                responseStatus.statusCode = 0;
                                responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                            }

                        } else {
                            await databaseConnection.query('ROLLBACK');

                            responseStatus.state = false;
                            responseStatus.statusCode = 0;
                            responseStatus.statusMessage = "El saldo de destino no existe.";

                        }

                    } else {
                        await databaseConnection.query('ROLLBACK');

                        responseStatus.state = false;
                        responseStatus.statusCode = 0;
                        responseStatus.statusMessage = "Hubo un error realizando el pago, intente nuevamente.";

                    }

                } else {
                    await databaseConnection.query('ROLLBACK');

                    responseStatus.state = false;
                    responseStatus.statusCode = 0;
                    responseStatus.statusMessage = "El valor de pago supera el saldo disponible.";

                }

            } else {
                await databaseConnection.query('ROLLBACK');

                responseStatus.state = false;
                responseStatus.statusCode = 0;
                responseStatus.statusMessage = "El saldo de origen no existe.";
    
            }

        } else {
            await databaseConnection.query('ROLLBACK');

            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'SendPaymentToEstablishment', now())`);

        response.json(responseContent);

    } catch(error) {
        await databaseConnection.query('ROLLBACK');
        response.status(500).send("Error: " +error.stack);

    } finally {
        databaseConnection.release();

    }

});

router.post("/v1/SendMissingProfileRecord", async(request, response) => {
    const databaseConnection = await database.connect();

    try {
        await databaseConnection.query('BEGIN');
        const requestContent = new RequestModel(request.body);

        const tools = new Tools();
        const validRequest = tools.validateIfTheRequestIsFromMiQPOAPP(requestContent);

        const responseStatus = new ResponseStatusModel();
        const responseContent = new ResponseModel();

        if(validRequest) {
            const listOfData = requestContent.listOfData;
            const profileToRegister = listOfData.profileToRegister;

            const userId = profileToRegister.userId;
            const profileTypeId = profileToRegister.profileTypeId;

            const userProfileValidationResult = await databaseConnection.query(`SELECT * FROM public.users u INNER JOIN public.user_profiles up ON u.id = up.user_id WHERE u.id = ${userId} AND up.profile_id = ${profileTypeId}`);
            
            if(userProfileValidationResult.rows.length > 0) {
                await databaseConnection.query('ROLLBACK');

                responseStatus.state = false;
                responseStatus.statusCode = 0;
                responseStatus.statusMessage = "Este perfil de usuario ya existe.";

            } else {
                const userProfileInsertResponse = await databaseConnection.query(`INSERT INTO public.user_profiles (user_id, profile_id) VALUES ('${userId}', '${profileTypeId}') RETURNING id`);

                if(userProfileInsertResponse.rows.length > 0) {
                    const userProfileId = userProfileInsertResponse.rows[0].id;

                    if(profileTypeId === 2) {
                        const establishmentInformation = profileToRegister.establishmentInformation;

                        const establishmentInformationInsertionResponse = await databaseConnection.query(`INSERT INTO public.commercial_establishments (user_profile_id, "name", nit, economic_activity_id)
                            VALUES(${userProfileId}, '${establishmentInformation.name}', '${establishmentInformation.nit}', ${establishmentInformation.economicActivityId});`);

                        if(establishmentInformationInsertionResponse.rowCount > 0) {
                            const quotaResponseByProfile = await databaseConnection.query(`SELECT * FROM public.quota_per_profile WHERE profile_id = ${profileTypeId}`);

                            var initialBalance = 0;
                            const currentDateAndTime = new Date();
                            const dateAndTime = format(currentDateAndTime, 'yyyy-MM-dd HH:mm:ss');

                            if(quotaResponseByProfile.rows.length > 0) {
                                initialBalance = quotaResponseByProfile.rows[0].value;

                            }

                            const dailyBalanceInsertionResponse = await databaseConnection.query(`INSERT INTO public.daily_balance (user_profile_id, initial_balance, final_balance, date_and_time)
                                VALUES(${userProfileId}, ${initialBalance}, ${initialBalance}, '${dateAndTime}')`);

                            if(dailyBalanceInsertionResponse.rowCount > 0) {
                                const quotaAllocationInsertionResponse = await databaseConnection.query(`INSERT INTO public.quota_allocation (user_profile_id, value)
                                    VALUES(${userProfileId}, ${initialBalance}) RETURNING id`);

                                if(quotaAllocationInsertionResponse.rows.length > 0) {
                                    const movementId = quotaAllocationInsertionResponse.rows[0].id;

                                    const motionInsertionResponse = await databaseConnection.query(`INSERT INTO public.movements (user_profile_id, movement_id, movement_type_id, value, date_and_time)
                                        VALUES(${userProfileId}, ${movementId}, 1, ${initialBalance}, '${dateAndTime}')`);

                                    if(motionInsertionResponse.rowCount > 0) {
                                        const resultOfRegisteredUserProfiles = await databaseConnection.query(`SELECT * FROM public.user_profiles WHERE id = ${userProfileId}`);
                                        const establishmentInformationResult = await databaseConnection.query(`SELECT * FROM public.commercial_establishments WHERE user_profile_id = ${userProfileId}`);
                                        const dailyBalanceResultRecorded = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${userProfileId}`);
                                        const resultOfQuotaAllocations = await databaseConnection.query(`SELECT * FROM public.quota_allocation WHERE user_profile_id = ${userProfileId}`);
                                        const resultOfMovements = await databaseConnection.query(`SELECT * FROM public.movements WHERE user_profile_id = ${userProfileId}`);

                                        if(resultOfRegisteredUserProfiles.rows.length > 0 && establishmentInformationResult.rows.length > 0 && dailyBalanceResultRecorded.rows.length > 0 && resultOfQuotaAllocations.rows.length > 0 && resultOfMovements.rows.length > 0) {
                                            const registeredProfile = new RegisteredProfileModel();

                                            const establishmentInformation = new RegisteredEstablishmentInformationModel();
                                            establishmentInformation.id = establishmentInformationResult.rows[0].id;
                                            establishmentInformation.name = establishmentInformationResult.rows[0].name;
                                            establishmentInformation.nit = establishmentInformationResult.rows[0].nit;
                                            establishmentInformation.economicActivityId = establishmentInformationResult.rows[0].economic_activity_id;
                                            establishmentInformation.userProfileId = establishmentInformationResult.rows[0].user_profile_id;

                                            registeredProfile.establishmentInformation = establishmentInformation;

                                            const userProfile = new UserProfileModel()
                                            userProfile.id = resultOfRegisteredUserProfiles.rows[0].id;
                                            userProfile.userId = resultOfRegisteredUserProfiles.rows[0].user_id;
                                            userProfile.profileId = resultOfRegisteredUserProfiles.rows[0].profile_id;

                                            registeredProfile.userProfile = userProfile;

                                            const dailyBalance = new DailyBalanceModel()
                                            dailyBalance.id = dailyBalanceResultRecorded.rows[0].id;
                                            dailyBalance.userProfileId = dailyBalanceResultRecorded.rows[0].user_profile_id;
                                            dailyBalance.initialBalance = dailyBalanceResultRecorded.rows[0].initial_balance;
                                            dailyBalance.finalBalance = dailyBalanceResultRecorded.rows[0].final_balance;
                                            dailyBalance.dateAndTime = dailyBalanceResultRecorded.rows[0].date_and_time;

                                            registeredProfile.dailyBalance = dailyBalance;

                                            const quotaAllocation = new QuotaAllocationModel()
                                            quotaAllocation.userProfileId = resultOfQuotaAllocations.rows[0].user_profile_id;
                                            quotaAllocation.value = resultOfQuotaAllocations.rows[0].value;

                                            registeredProfile.quotaAllocation = quotaAllocation;

                                            /** 
                                            * @type {Array<MotionModel>} 
                                            */
                                            const listOfMovements = [];

                                            resultOfMovements.rows.forEach(motion => {
                                                const newMovement = new MotionModel()
                                                newMovement.id = motion.id;
                                                newMovement.userProfileId = motion.user_profile_id;
                                                newMovement.movementId = motion.movement_id;
                                                newMovement.movementTypeId = motion.movement_type_id;
                                                newMovement.description = motion.description;
                                                newMovement.value = motion.value;
                                                newMovement.dateAndTime = motion.date_and_time;

                                                listOfMovements.push(newMovement);

                                            });

                                            registeredProfile.listOfMovements = listOfMovements;

                                            const listOfData = new ResponseDataListModel();
                                            listOfData.registeredProfile = registeredProfile;

                                            responseContent.listOfData = listOfData;

                                            responseStatus.state = true;
                                            responseStatus.statusCode = 200;
                                            responseStatus.statusMessage = "Inserción ejecutada correctamente.";

                                            await databaseConnection.query('COMMIT');

                                        } else {
                                            await databaseConnection.query('ROLLBACK');
                                            
                                            responseStatus.state = false;
                                            responseStatus.statusCode = 0;
                                            responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                        }

                                    } else {
                                        await databaseConnection.query('ROLLBACK');

                                        responseStatus.state = false;
                                        responseStatus.statusCode = 0;
                                        responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                    }

                                } else {
                                    await databaseConnection.query('ROLLBACK');

                                    responseStatus.state = false;
                                    responseStatus.statusCode = 0;
                                    responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                                }

                            } else {
                                await databaseConnection.query('ROLLBACK');

                                responseStatus.state = false;
                                responseStatus.statusCode = 0;
                                responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                            }


                        } else {
                            await databaseConnection.query('ROLLBACK');

                            responseStatus.state = false;
                            responseStatus.statusCode = 0;
                            responseStatus.statusMessage = "No se pudo realizar el registro de usuario, intente nuevamente.";

                        }

                    } else {
                        const quotaResponseByProfile = await databaseConnection.query(`SELECT * FROM public.quota_per_profile WHERE profile_id = ${profileTypeId}`);

                        var initialBalance = 0;
                        const currentDateAndTime = new Date();
                        const dateAndTime = format(currentDateAndTime, 'yyyy-MM-dd HH:mm:ss');

                        if(quotaResponseByProfile.rows.length > 0) {
                            initialBalance = quotaResponseByProfile.rows[0].value;

                        }

                        const dailyBalanceInsertionResponse = await databaseConnection.query(`INSERT INTO public.daily_balance (user_profile_id, initial_balance, final_balance, date_and_time)
                            VALUES(${userProfileId}, ${initialBalance}, ${initialBalance}, '${dateAndTime}')`);

                        if(dailyBalanceInsertionResponse.rowCount > 0) {
                            const quotaAllocationInsertionResponse = await databaseConnection.query(`INSERT INTO public.quota_allocation (user_profile_id, value)
                                VALUES(${userProfileId}, ${initialBalance}) RETURNING id`);

                            if(quotaAllocationInsertionResponse.rows.length > 0) {
                                const movementId = quotaAllocationInsertionResponse.rows[0].id;

                                const motionInsertionResponse = await databaseConnection.query(`INSERT INTO public.movements (user_profile_id, movement_id, movement_type_id, value, date_and_time)
                                    VALUES(${userProfileId}, ${movementId}, 1, ${initialBalance}, '${dateAndTime}')`);

                                if(motionInsertionResponse.rowCount > 0) {
                                    const resultOfRegisteredUserProfiles = await databaseConnection.query(`SELECT * FROM public.user_profiles WHERE id = ${userProfileId}`);
                                    const dailyBalanceResultRecorded = await databaseConnection.query(`SELECT * FROM public.daily_balance WHERE user_profile_id = ${userProfileId}`);
                                    const resultOfQuotaAllocations = await databaseConnection.query(`SELECT * FROM public.quota_allocation WHERE user_profile_id = ${userProfileId}`);
                                    const resultOfMovements = await databaseConnection.query(`SELECT * FROM public.movements WHERE user_profile_id = ${userProfileId}`);

                                    if(resultOfRegisteredUserProfiles.rows.length > 0 && dailyBalanceResultRecorded.rows.length > 0 && resultOfQuotaAllocations.rows.length > 0 && resultOfMovements.rows.length > 0) {
                                        const registeredProfile = new RegisteredProfileModel();

                                        const userProfile = new UserProfileModel()
                                        userProfile.id = resultOfRegisteredUserProfiles.rows[0].id;
                                        userProfile.userId = resultOfRegisteredUserProfiles.rows[0].user_id;
                                        userProfile.profileId = resultOfRegisteredUserProfiles.rows[0].profile_id;

                                        registeredProfile.userProfile = userProfile;

                                        const dailyBalance = new DailyBalanceModel()
                                        dailyBalance.id = dailyBalanceResultRecorded.rows[0].id;
                                        dailyBalance.userProfileId = dailyBalanceResultRecorded.rows[0].user_profile_id;
                                        dailyBalance.initialBalance = dailyBalanceResultRecorded.rows[0].initial_balance;
                                        dailyBalance.finalBalance = dailyBalanceResultRecorded.rows[0].final_balance;
                                        dailyBalance.dateAndTime = dailyBalanceResultRecorded.rows[0].date_and_time;

                                        registeredProfile.dailyBalance = dailyBalance;

                                        const quotaAllocation = new QuotaAllocationModel()
                                        quotaAllocation.userProfileId = resultOfQuotaAllocations.rows[0].user_profile_id;
                                        quotaAllocation.value = resultOfQuotaAllocations.rows[0].value;

                                        registeredProfile.quotaAllocation = quotaAllocation;

                                        /** 
                                        * @type {Array<MotionModel>} 
                                        */
                                        const listOfMovements = [];

                                        resultOfMovements.rows.forEach(motion => {
                                            const newMovement = new MotionModel()
                                            newMovement.id = motion.id;
                                            newMovement.userProfileId = motion.user_profile_id;
                                            newMovement.movementId = motion.movement_id;
                                            newMovement.movementTypeId = motion.movement_type_id;
                                            newMovement.description = motion.description;
                                            newMovement.value = motion.value;
                                            newMovement.dateAndTime = motion.date_and_time;

                                            listOfMovements.push(newMovement);

                                        });

                                        registeredProfile.listOfMovements = listOfMovements;

                                        const listOfData = new ResponseDataListModel()
                                        listOfData.registeredProfile = registeredProfile

                                        responseContent.listOfData = listOfData

                                        responseStatus.state = true;
                                        responseStatus.statusCode = 200;
                                        responseStatus.statusMessage = "Inserción ejecutada correctamente.";

                                        await databaseConnection.query('COMMIT');

                                    } else {
                                        await databaseConnection.query('ROLLBACK');
                                        
                                        responseStatus.state = false;
                                        responseStatus.statusCode = 0;
                                        responseStatus.statusMessage = "No se pudo realizar el registro de este perfil de usuario, intente nuevamente.";

                                    }

                                } else {
                                    await databaseConnection.query('ROLLBACK');

                                    responseStatus.state = false;
                                    responseStatus.statusCode = 0;
                                    responseStatus.statusMessage = "No se pudo realizar el registro de este perfil de usuario, intente nuevamente.";

                                }

                            } else {
                                await databaseConnection.query('ROLLBACK');

                                responseStatus.state = false;
                                responseStatus.statusCode = 0;
                                responseStatus.statusMessage = "No se pudo realizar el registro de este perfil de usuario, intente nuevamente.";

                            }

                        } else {
                            await databaseConnection.query('ROLLBACK');

                            responseStatus.state = false;
                            responseStatus.statusCode = 0;
                            responseStatus.statusMessage = "No se pudo realizar el registro de este perfil de usuario, intente nuevamente.";

                        }

                    }

                } else {
                    await databaseConnection.query('ROLLBACK');

                    responseStatus.state = false;
                    responseStatus.statusCode = 0;
                    responseStatus.statusMessage = "No se pudo realizar el registro de este perfil de usuario, intente nuevamente.";

                }

            }

        } else {
            responseStatus.state = false;
            responseStatus.statusCode = 0;
            responseStatus.statusMessage = "Solicitud de proyecto inválido.";

        }
        
        responseContent.responseStatus = responseStatus;

        databaseConnection.query(`INSERT INTO public.api_requests (json_request, json_response, endpoint, date_and_time)
            VALUES('${JSON.stringify(request.body)}', '${JSON.stringify(responseContent)}', 'SendMissingProfileRecord', now())`);

        response.json(responseContent);

    } catch(error) {
        await databaseConnection.query('ROLLBACK');
        response.status(500).send(error.stack);

    } finally {
        databaseConnection.release();

    }

});

module.exports = router;