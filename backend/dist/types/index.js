"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseCategory = exports.PaymentStatus = exports.InvoiceStatus = exports.TaskPriority = exports.TaskStatus = exports.ProjectStatus = void 0;
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["ACTIVE"] = "active";
    ProjectStatus["COMPLETED"] = "completed";
    ProjectStatus["ON_HOLD"] = "on-hold";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["TODO"] = "todo";
    TaskStatus["IN_PROGRESS"] = "in-progress";
    TaskStatus["COMPLETED"] = "completed";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "draft";
    InvoiceStatus["SENT"] = "sent";
    InvoiceStatus["PAID"] = "paid";
    InvoiceStatus["OVERDUE"] = "overdue";
    InvoiceStatus["CANCELLED"] = "cancelled";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["PARTIAL"] = "partial";
    PaymentStatus["PAID"] = "paid";
    PaymentStatus["FAILED"] = "failed";
    PaymentStatus["REFUNDED"] = "refunded";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["TRAVEL"] = "travel";
    ExpenseCategory["EQUIPMENT"] = "equipment";
    ExpenseCategory["SOFTWARE"] = "software";
    ExpenseCategory["MARKETING"] = "marketing";
    ExpenseCategory["OFFICE"] = "office";
    ExpenseCategory["PROFESSIONAL"] = "professional";
    ExpenseCategory["OTHER"] = "other";
})(ExpenseCategory || (exports.ExpenseCategory = ExpenseCategory = {}));
//# sourceMappingURL=index.js.map