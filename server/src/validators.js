export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} 不能为空`);
  }
}

function requireString(value, field) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} 必须是字符串`);
  }
}

function requireNumberOrNull(value, field) {
  if (value !== null && typeof value !== 'number') {
    throw new ValidationError(`${field} 必须是数字或 null`);
  }
}

export function validateWorkoutSession(body) {
  if (!isObject(body)) {
    throw new ValidationError('请求体必须是对象');
  }
  requireNonEmptyString(body.id, 'id');
  requireNonEmptyString(body.date, 'date');
  requireNonEmptyString(body.planId, 'planId');
  requireNonEmptyString(body.dayId, 'dayId');
  if (!Array.isArray(body.exerciseLogs)) {
    throw new ValidationError('exerciseLogs 必须是数组');
  }
  for (const log of body.exerciseLogs) {
    if (!isObject(log)) {
      throw new ValidationError('exerciseLogs 的每一项必须是对象');
    }
    requireNonEmptyString(log.exerciseId, 'exerciseId');
    requireString(log.note, 'note');
    if (!Array.isArray(log.sets)) {
      throw new ValidationError('sets 必须是数组');
    }
    for (const set of log.sets) {
      if (!isObject(set) || typeof set.setNumber !== 'number') {
        throw new ValidationError('set.setNumber 必须是数字');
      }
      requireNumberOrNull(set.weight, 'set.weight');
      requireNumberOrNull(set.reps, 'set.reps');
      if (typeof set.completed !== 'boolean') {
        throw new ValidationError('set.completed 必须是布尔值');
      }
    }
  }
  return body;
}

export function validateCustomPlan(body) {
  if (!isObject(body)) {
    throw new ValidationError('请求体必须是对象');
  }
  requireNonEmptyString(body.id, 'id');
  requireString(body.coachName, 'coachName');
  requireString(body.title, 'title');
  requireString(body.description, 'description');
  requireString(body.sourceUrl, 'sourceUrl');
  requireNonEmptyString(body.planType, 'planType');
  if (!Array.isArray(body.days)) {
    throw new ValidationError('days 必须是数组');
  }
  for (const day of body.days) {
    if (!isObject(day)) {
      throw new ValidationError('days 的每一项必须是对象');
    }
    requireNonEmptyString(day.id, 'day.id');
    requireString(day.name, 'day.name');
    requireString(day.sourceUrl, 'day.sourceUrl');
    if (!Array.isArray(day.focus)) {
      throw new ValidationError('day.focus 必须是数组');
    }
    if (!Array.isArray(day.exerciseIds)) {
      throw new ValidationError('day.exerciseIds 必须是数组');
    }
  }
  return body;
}
