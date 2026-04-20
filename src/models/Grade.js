class Grade {
  constructor(
    studentId,
    subject,
    value,
    semester,
    attendedLessons,
    totalLessons,
  ) {
    this.studentId = studentId;
    this.subject = subject;
    this.value = value;
    this.semester = semester;
    this.attendedLessons = attendedLessons;
    this.totalLessons = totalLessons;
  }
}

module.exports = { Grade };
