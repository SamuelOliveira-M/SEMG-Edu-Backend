import express  from "express";
import TransetionSchoolClassController from "../useCase/turma/transetion/TransetionSchoolClassController";
import CreateSubjectsController from "../useCase/disciplina/create/CreateSubjectController";
import TransetionSchoolController from "../useCase/escola/transetion/TransetionSchoolController";
import CreateTeacherController from "../useCase/professor/create/CreateTeacherController";
import CreateGradeController from "../useCase/notas/create/CreateGradeController";
import CreateManagerController from "../useCase/gestor/create/CreateManagerController";

import AddSubjectToTeacherController from "../useCase/allocation/allocationOfTeacher/create/AllocationOfTeacherController";

import ReadManagerController from "../useCase/gestor/read/ReadManagerController";
import ReadSchoolClassController from "../useCase/turma/read/ReadSchoolClassController";
import RemoveSubjectFromTeacherController from "../useCase/professor/delete/RemoveSubjectFromTeacherController";
import ReadTimeRangeController from "../useCase/horario/read/ReadTimeRangeController";

import { uploadImage } from "../middlewares/uploadToFirebaseStorage";
import Multer from 'multer'
import ReadCalendarController from "../useCase/calendario/read/ReadCalendarController";
import { ensureAuthenticated } from "../middlewares/ensureAuthenticated";
import AutenticationController from "../useCase/autentication/AutenticationController";
import GenerateTokenController from "../useCase/refreshtoken/generateToken/GenerateTokenController";
import { get } from "http";
import GetStatisticsController from "../useCase/getStatistics/GetStatisticsController";
import TransetionCalendarController from "../useCase/calendario/transetion/TransetionCalendarController";
import DeleteClassController from "../useCase/turma/delete/DeleteClassController";
import ReadSubjectController from "../useCase/disciplina/read/ReadSubjectController";


const multer = Multer({
	storage: Multer.memoryStorage(),
});

const schoolRoutes = express.Router();

schoolRoutes.post("/escola",TransetionSchoolController.transetionSchool)
schoolRoutes.post("/create/turma/:cod_inep",TransetionSchoolClassController.transetionSchoolClass)
schoolRoutes.post("/disciplina",CreateSubjectsController.createSubjectsController)
//schoolRoutes.post("/create/professor",multer.single('file'),uploadImage,CreateTeacherController.createTeacherController)
schoolRoutes.post("/create/professor",CreateTeacherController.createTeacherController)

schoolRoutes.post("/nota/:registrationId",CreateGradeController.CreateGradeController)
schoolRoutes.post("/gestor",CreateManagerController.createTeacherController)
schoolRoutes.post("/allocation/teacher",AddSubjectToTeacherController.AddSubjectToTeacher)
schoolRoutes.post("/calendario",TransetionCalendarController.transetionClassCalendar)
schoolRoutes.post("/login",AutenticationController.authenticate)
schoolRoutes.post('/refreshtoken',GenerateTokenController.generateToken)
schoolRoutes.post("/add/notas",CreateGradeController.ModifyGradeController)




schoolRoutes.get("/calendar/:classId",ReadCalendarController.readCalendarController)

schoolRoutes.get("/gestor",ReadManagerController.readManagerController)
schoolRoutes.get("/class/:query?",ReadSchoolClassController.readSchoolClass)
schoolRoutes.get("/classroom/:id",ReadSchoolClassController.readSchoolClassFindFirst)

schoolRoutes.get("/subjects/:classId",ReadSubjectController.allSubjects)

schoolRoutes.get("/tumasdoprofessorrr/:id",ReadSchoolClassController.ReadTeacherClasses)

schoolRoutes.get("/horarios",ReadTimeRangeController.readTimeRangeController)

schoolRoutes.get("/getStatistics",GetStatisticsController.getStatistics)

schoolRoutes.delete("/remove/disciplina",RemoveSubjectFromTeacherController.removeSubjectFromTeacher)
schoolRoutes.delete("/remove/class/:classId",DeleteClassController.deleteclass)

export default schoolRoutes;
