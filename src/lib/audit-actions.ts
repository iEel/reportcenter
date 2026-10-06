/** Thai names for the ActivityLogs action types written by the API routes. */
const ACTION_LABELS: Record<string, string> = {
    LOGIN: 'เข้าสู่ระบบ',
    LOGOUT: 'ออกจากระบบ',
    LOGIN_FAIL: 'เข้าสู่ระบบไม่สำเร็จ',
    CHANGE_PASSWORD: 'เปลี่ยนรหัสผ่าน',
    RESET_PASSWORD: 'รีเซ็ตรหัสผ่าน',
    EXECUTE_REPORT: 'รันรายงาน',
    EXPORT_EXCEL: 'ส่งออก Excel',
    BLOCKED_QUERY: 'SQL ถูกบล็อก',
    CREATE_REPORT: 'สร้างรายงาน',
    UPDATE_REPORT: 'แก้ไขรายงาน',
    ROLLBACK_REPORT: 'ย้อนเวอร์ชันรายงาน',
    CREATE_USER: 'สร้างผู้ใช้',
    UPDATE_USER: 'แก้ไขผู้ใช้',
    DELETE_USER: 'ลบผู้ใช้',
    CREATE_SCHEDULE: 'สร้างกำหนดการ',
    UPDATE_SCHEDULE: 'แก้ไขกำหนดการ',
    DELETE_SCHEDULE: 'ลบกำหนดการ',
    RUN_SCHEDULE: 'รันกำหนดการเอง',
    CRON_SUCCESS: 'ส่งตามกำหนดการสำเร็จ',
    CRON_FAIL: 'ส่งตามกำหนดการไม่สำเร็จ',
    AD_SYNC: 'ซิงก์ AD',
    AD_SYNC_CRON: 'ซิงก์ AD อัตโนมัติ',
};

/** Thai name of an action type, or the code itself when it has none. */
export function actionLabel(code: string) {
    return ACTION_LABELS[code] ?? code;
}

/** Filter option text: the Thai name with the code admins see in logs and exports. */
export function actionOptionLabel(code: string) {
    return ACTION_LABELS[code] ? `${ACTION_LABELS[code]} (${code})` : code;
}
