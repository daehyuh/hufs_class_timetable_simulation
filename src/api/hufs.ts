const HUFS_ENDPOINT = 'https://wis.hufs.ac.kr/hufs'

const decodeBody = <T>(body: string): T => JSON.parse(decodeURIComponent(body))

const normalizeArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

const postForm = async <T>(payload: Record<string, string>): Promise<T> => {
  const res = await fetch(HUFS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  })
  if (!res.ok) {
    throw new Error(`HUFS API ${res.status}`)
  }
  const text = await res.text()
  return decodeBody<T>(text)
}

export type MajorOption = {
  code: string
  name: string
  nameEng: string
  campus: string
  campusEng: string
  deptLevel?: string
}

export type CourseRow = {
  code: string
  name: string
  nameEng: string
  professor: string
  professorEng: string
  credit: number
  grade: string
  time: string
  timeEng: string
  area: string
  isEnglish: boolean
  isOnline: boolean
  syllabus: boolean
  remark: string
}

export type FieldOption = {
  code: string
  name: string
  nameEng: string
  campus?: string
}

type MajorResponse = {
  dataCount: string
  data: Array<{
    hakkwaCode1: string
    hakkwaName1: string
    hakkwaName1E: string
    campusName1: string
    campusName1E: string
    deptLevel?: string
  }>
}

type FieldResponse = {
  dataCount: string
  data: Array<{
    fieldCode2: string
    fieldName2: string
    fieldName2E: string
    campusName2: string
    campusName2E: string
  }>
}

type CourseResponse = {
  dataCount: string
  data?: RawCourse[] | RawCourse
}

type RawCourse = {
  lssnCd: string
  subjtNaKr: string
  subjtNaEng: string
  empNm: string
  empNmEng: string
  unitNum: string
  dstGrad: string
  dayTimeDisplay: string
  dayTimeDisplayE: string
  comptFldNm: string
  comptFldNaEng: string
  wongangFlag: string
  cyberFlag: string
  syllabusFlag: string
  etc: string
}

export async function fetchMajors(params: {
  year: string
  session: string
  campus: 'H1' | 'H2'
}): Promise<MajorOption[]> {
  const response = await postForm<MajorResponse>({
    mName: 'process3_1a',
    cName: 'hufs.stu1.STU1_C008',
    org_sect: 'A',
    ledg_year: params.year,
    ledg_sessn: params.session,
    campus: params.campus,
  })

  const items = normalizeArray(response.data)
  return items.map((item) => ({
    code: item.hakkwaCode1,
    name: item.hakkwaName1,
    nameEng: item.hakkwaName1E,
    campus: item.campusName1,
    campusEng: item.campusName1E,
    deptLevel: item.deptLevel,
  }))
}

export async function fetchLiberalArts(params: {
  year: string
  session: string
  campus: 'H1' | 'H2'
  mode: 'liberal' | 'basic'
}): Promise<FieldOption[]> {
  const response = await postForm<FieldResponse>({
    mName: params.mode === 'liberal' ? 'process4_1a' : 'process4_1b',
    cName: 'hufs.stu1.STU1_C008',
    ledg_year: params.year,
    ledg_sessn: params.session,
    campus: params.campus,
  })

  const items = normalizeArray(response.data)
  return items.map((item) => ({
    code: item.fieldCode2,
    name: item.fieldName2,
    nameEng: item.fieldName2E,
    campus: item.campusName2,
  }))
}

export async function fetchCourses(params: {
  year: string
  session: string
  campus: 'H1' | 'H2'
  majorCode: string
  gubun: '1' | '2' | '3'
}): Promise<CourseRow[]> {
  const response = await postForm<CourseResponse>({
    mName: 'getDataLssnLista',
    cName: 'hufs.stu1.STU1_C009',
    org_sect: 'A',
    ledg_year: params.year,
    ledg_sessn: params.session,
    campus: params.campus,
    crs_strct_cd: params.majorCode,
    gubun: params.gubun,
    subjt_nm: '',
    won: '',
    cyber: '',
    emp_nm: '',
    d1: 'N',
    d2: 'N',
    d3: 'N',
    d4: 'N',
    d5: 'N',
    d6: 'N',
    t1: 'N',
    t2: 'N',
    t3: 'N',
    t4: 'N',
    t5: 'N',
    t6: 'N',
    t7: 'N',
    t8: 'N',
    t9: 'N',
    t10: 'N',
    t11: 'N',
    t12: 'N',
  })

  const items = normalizeArray(response.data)
  return items.map((item) => ({
    code: item.lssnCd,
    name: item.subjtNaKr || item.subjtNaEng || '-',
    nameEng: item.subjtNaEng || item.subjtNaKr || '-',
    professor: item.empNm,
    professorEng: item.empNmEng,
    credit: Number(item.unitNum) || 0,
    grade: item.dstGrad,
    time: item.dayTimeDisplay,
    timeEng: item.dayTimeDisplayE,
    area: item.comptFldNm || item.comptFldNaEng || '',
    isEnglish: item.wongangFlag === 'Y',
    isOnline: item.cyberFlag === 'Y',
    syllabus: item.syllabusFlag === 'Y',
    remark: item.etc,
  }))
}
