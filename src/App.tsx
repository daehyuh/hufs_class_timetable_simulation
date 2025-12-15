import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import {
  fetchCourses,
  fetchLiberalArts,
  fetchMajors,
  type CourseRow,
  type FieldOption,
  type MajorOption,
} from './api/hufs'
import baseCourses, { type Course, type Day } from './data/courses'
import './App.css'

const dayOrder: Day[] = ['월', '화', '수', '목', '금']
const STORAGE_KEY = 'saved-timetables'
const periods = [
  { num: 1, time: '09:00~10:00' },
  { num: 2, time: '10:00~11:00' },
  { num: 3, time: '11:00~12:00' },
  { num: 4, time: '12:00~13:00' },
  { num: 5, time: '13:00~14:00' },
  { num: 6, time: '14:00~15:00' },
  { num: 7, time: '15:00~16:00' },
  { num: 8, time: '16:00~17:00' },
  { num: 9, time: '17:00~18:00' },
  { num: 10, time: '18:00~19:00' },
  { num: 11, time: '19:00~20:00' },
  { num: 12, time: '20:00~21:00' },
]

type SavedPlan = {
  id: string
  name: string
  selectedIds: number[]
  createdAt: number
}

const formatSlots = (course: Course) => {
  const chunks = course.slots.map((slot) => {
    if (slot.periods.length === 0) {
      return `${slot.day} -`
    }
    return `${slot.day} ${slot.periods.join('·')}`
  })
  return chunks.join(', ')
}

const overlapsCourse = (target: Course, others: Course[]) =>
  others.some(
    (other) =>
      other.id !== target.id &&
      other.slots.some((otherSlot) =>
        target.slots.some(
          (slot) =>
            slot.day === otherSlot.day &&
            slot.periods.some((period) => otherSlot.periods.includes(period))
        )
      )
  )

function App() {
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all')
  const [dayFilter, setDayFilter] = useState<Day | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [apiYear, setApiYear] = useState('2026')
  const [apiSession, setApiSession] = useState<'1' | '2' | '3' | '4'>('1')
  const [campus, setCampus] = useState<'H1' | 'H2'>('H2')
  const [majors, setMajors] = useState<(MajorOption | FieldOption)[]>([])
  const [selectedMajor, setSelectedMajor] = useState('ATJA1')
  const [liveCourses, setLiveCourses] = useState<CourseRow[]>([])
  const [liveMajor, setLiveMajor] = useState('')
  const [apiCourses, setApiCourses] = useState<Course[]>([])
  const [loadingMajors, setLoadingMajors] = useState(false)
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [gubun, setGubun] = useState<'1' | '2' | '3'>('1')
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [planName, setPlanName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [saveModal, setSaveModal] = useState(false)
  const [exploreCollapsed, setExploreCollapsed] = useState(true)
  const [repoDescription, setRepoDescription] = useState<string>('불러오는 중…')
  const apiCourseIdRef = useRef(100000)
  const timetableRef = useRef<HTMLDivElement>(null)
  const timetableGridRef = useRef<HTMLDivElement>(null)

  const maxPeriod = periods.length

  const allCourses = useMemo(() => (apiCourses.length ? apiCourses : baseCourses), [apiCourses])

  const displayCourses = useMemo(() => {
    if (!apiCourses.length) return allCourses
    return apiCourses.filter(
      (course) => !course.sourceMajor || course.sourceMajor === selectedMajor
    )
  }, [allCourses, apiCourses, selectedMajor])

  const selectedCourses = useMemo(
    () => allCourses.filter((course) => selectedIds.includes(course.id)),
    [allCourses, selectedIds]
  )

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase()
    return displayCourses.filter((course) => {
      const byGrade = gradeFilter === 'all' || course.grade === gradeFilter
      const byDay = dayFilter === 'all' || course.slots.some((slot) => slot.day === dayFilter)
      const byTerm =
        term.length === 0 ||
        [course.name, course.professor, course.code].some((value) =>
          value.toLowerCase().includes(term)
        )
      return byGrade && byDay && byTerm
    })
  }, [dayFilter, displayCourses, gradeFilter, search])

  const timetable = useMemo(() => {
    const grid: Record<Day, Record<number, Course[]>> = {
      월: {},
      화: {},
      수: {},
      목: {},
      금: {},
    }
    const conflicts = new Set<number>()

    selectedCourses.forEach((course) => {
      course.slots.forEach((slot) => {
        slot.periods.forEach((period) => {
          const bucket = grid[slot.day][period] ?? []
          bucket.push(course)
          grid[slot.day][period] = bucket
        })
      })
    })

    Object.values(grid).forEach((dayMap) => {
      Object.values(dayMap).forEach((bucket) => {
        if (bucket.length > 1) {
          bucket.forEach((course) => conflicts.add(course.id))
        }
      })
    })

    return { grid, conflicts }
  }, [selectedCourses])

  const totalCredits = selectedCourses.reduce((sum, course) => sum + course.credit, 0)

  const toggleCourse = (course: Course) => {
    setSelectedIds((prev) =>
      prev.includes(course.id) ? prev.filter((id) => id !== course.id) : [...prev, course.id]
    )
  }

  const conflictWithSelection = (course: Course) => {
    if (selectedIds.includes(course.id)) {
      return timetable.conflicts.has(course.id)
    }
    return overlapsCourse(course, selectedCourses)
  }

  const loadMajors = async () => {
    setLoadingMajors(true)
    setApiError(null)
    try {
      let list: (MajorOption | FieldOption)[] = []
      if (gubun === '1') {
        list = await fetchMajors({ year: apiYear, session: apiSession, campus })
      } else if (gubun === '2') {
        list = await fetchLiberalArts({ year: apiYear, session: apiSession, campus, mode: 'liberal' })
      } else {
        list = await fetchLiberalArts({ year: apiYear, session: apiSession, campus, mode: 'basic' })
      }
      setMajors(list)
      const preferred = 'ATJA1'
      const hasPreferred = gubun === '1' && list.some((item) => item.code === preferred)
      const hasCurrent = selectedMajor && list.some((item) => item.code === selectedMajor)
      const nextSelection = hasPreferred
        ? preferred
        : hasCurrent
          ? selectedMajor
          : list[0]?.code ?? ''
      setSelectedMajor(nextSelection)
      setLiveCourses([])
      if (list.length === 0) {
        setApiError('조회된 학과/영역이 없습니다.')
      }
    } catch (error) {
      setApiError((error as Error).message || '학과 목록을 불러오지 못했습니다.')
    } finally {
      setLoadingMajors(false)
    }
  }

  const loadCourses = async () => {
    if (!selectedMajor) return
    setLoadingCourses(true)
    setApiError(null)
    try {
      const list = await fetchCourses({
        year: apiYear,
        session: apiSession,
        campus,
        majorCode: selectedMajor,
        gubun,
      })
      setLiveMajor(selectedMajor)
      setLiveCourses(list)
      if (list.length === 0) {
        setApiError('조회된 강좌가 없습니다.')
      }
    } catch (error) {
      setApiError((error as Error).message || '강좌를 불러오지 못했습니다.')
      setLiveCourses([])
    } finally {
      setLoadingCourses(false)
    }
  }

  useEffect(() => {
    loadMajors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiYear, apiSession, campus, gubun])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as SavedPlan[]
      setSavedPlans(parsed)
    } catch (error) {
      console.error('Failed to load saved plans', error)
    }
  }, [])

  const persistPlans = (plans: SavedPlan[]) => {
    setSavedPlans(plans)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
  }

  const saveCurrentPlan = () => {
    const name =
      planName.trim().length > 0 ? planName.trim() : `시간표 ${savedPlans.length + 1}`
    const next: SavedPlan = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      selectedIds,
      createdAt: Date.now(),
    }
    persistPlans([next, ...savedPlans])
    setSaveModal(false)
    setPlanName('')
  }

  const loadPlan = (plan: SavedPlan) => {
    setSelectedIds(plan.selectedIds)
  }

  const deletePlan = (plan: SavedPlan) => {
    const filtered = savedPlans.filter((item) => item.id !== plan.id)
    persistPlans(filtered)
  }

  const exportTimetable = async () => {
    const target = timetableGridRef.current ?? timetableRef.current
    if (!target || exporting) return
    setExporting(true)
    try {
      const el = target
      const prevWidth = el.style.width
      const width = Math.max(el.scrollWidth, el.clientWidth, 1200)
      const height = el.scrollHeight
      el.style.width = `${width}px`
      const canvas = await html2canvas(el, {
        backgroundColor: '#050914',
        scale: 3,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      })
      el.style.width = prevWidth
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `timetable-${Date.now()}.png`
      link.click()
    } catch (error) {
      console.error('Export failed', error)
    } finally {
      setExporting(false)
    }
  }

  const dayTokenMap: Record<string, Day> = {
    월: '월',
    화: '화',
    수: '수',
    목: '목',
    금: '금',
    Mon: '월',
    'Mon.': '월',
    Tue: '화',
    'Tue.': '화',
    Wed: '수',
    'Wed.': '수',
    Thu: '목',
    'Thu.': '목',
    Thur: '목',
    'Thur.': '목',
    Fri: '금',
    'Fri.': '금',
  }

  const parseSlots = (text: string): Course['slots'] => {
    const clean = text.replace(/[()]/g, ' ')
    const tokens = clean.split(/\s+/).filter(Boolean)
    const buckets: Record<Day, number[]> = { 월: [], 화: [], 수: [], 목: [], 금: [] }
    let currentDay: Day | null = null

    tokens.forEach((token) => {
      const day = dayTokenMap[token]
      if (day) {
        currentDay = day
        return
      }
      if (/^\d+$/.test(token) && currentDay) {
        buckets[currentDay].push(Number(token))
      }
    })

    return (Object.keys(buckets) as Day[])
      .map((day) => ({ day, periods: buckets[day].sort((a, b) => a - b) }))
      .filter((slot) => slot.periods.length > 0)
  }

  useEffect(() => {
    if (liveCourses.length === 0) return

    // Merge newly fetched courses instead of resetting so selections survive across majors
    setApiCourses((prev) => {
      const existingByCode = new Map(prev.map((course) => [course.code, course]))
      const updated = [...prev]

      liveCourses.forEach((item) => {
        const existing = existingByCode.get(item.code)
        const course: Course = {
          id: existing?.id ?? apiCourseIdRef.current++,
          area: item.area,
          grade: Number(item.grade) || 0,
          code: item.code,
          name: item.name,
          professor: item.professor,
          credit: item.credit,
          slots: parseSlots(item.time || item.timeEng || item.code),
          english: item.isEnglish,
          remarks: item.remark,
          sourceMajor: liveMajor || selectedMajor,
        }

        if (existing) {
          const index = updated.findIndex((value) => value.code === item.code)
          if (index >= 0) {
            updated[index] = course
          }
        } else {
          updated.push(course)
        }

        existingByCode.set(item.code, course)
      })

      return updated
    })
  }, [liveCourses, liveMajor, selectedMajor])

  useEffect(() => {
    fetch('https://api.github.com/repos/daehyuh/hufs_class_timetable_simulation')
      .then(async (res) => {
        if (!res.ok) throw new Error(`GitHub API ${res.status}`)
        const data = await res.json()
        setRepoDescription(data.description || '설명이 없습니다.')
      })
      .catch(() => setRepoDescription('설명을 불러오지 못했습니다.'))
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <div className="title-row">
          <img className="site-logo" src="/logo.png" alt="한국외대 시간표 시물레이션 로고" />
          <div>
            <h1>
              한국외대 시간표 시물레이션
            </h1>
            <p className="repo-description">{repoDescription}</p>
          </div>
        </div>
      </header>
      <section className="panel live-panel">
        <div className="live-grid">
          <div className="controls-card">
            <div className="controls-head">
              <div>
                <p className="subtle">실시간 조회</p>
                <h2>HUFS 강좌 선택</h2>
              </div>
              <div className="stat-chips">
                <span className="stat-chip">학과 {majors.length}개</span>
                <span className="stat-chip">강좌 {liveCourses.length}개</span>
              </div>
            </div>
            <div className="api-grid">
              <label className="api-field">
                <span>년도</span>
                <input
                  type="number"
                  min="2000"
                  value={apiYear}
                  onChange={(event) => setApiYear(event.target.value)}
                />
              </label>
              <label className="api-field">
                <span>학기</span>
                <select
                  value={apiSession}
                  onChange={(event) => setApiSession(event.target.value as typeof apiSession)}
                >
                  <option value="1">1학기</option>
                  <option value="2">여름학기</option>
                  <option value="3">2학기</option>
                  <option value="4">겨울학기</option>
                </select>
              </label>
              <label className="api-field">
                <span>캠퍼스</span>
                <select value={campus} onChange={(event) => setCampus(event.target.value as typeof campus)}>
                  <option value="H1">서울</option>
                  <option value="H2">글로벌</option>
                </select>
              </label>
              <label className="api-field">
                <span>구분</span>
                <div className="radio-row">
                  <label>
                    <input
                      type="radio"
                      name="gubun"
                      value="1"
                      checked={gubun === '1'}
                      onChange={() => setGubun('1')}
                    />
                    전공
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gubun"
                      value="2"
                      checked={gubun === '2'}
                      onChange={() => setGubun('2')}
                    />
                    교양
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gubun"
                      value="3"
                      checked={gubun === '3'}
                      onChange={() => setGubun('3')}
                    />
                    기초
                  </label>
                </div>
              </label>
              <button className="cta fill" type="button" onClick={loadMajors} disabled={loadingMajors}>
                {loadingMajors ? '불러오는 중…' : '학과 목록 불러오기'}
              </button>
            </div>
            <div className="api-grid">
              <label className="api-field">
                <span>학과/분야 선택</span>
                <select
                  value={selectedMajor}
                  onChange={(event) => setSelectedMajor(event.target.value)}
                  disabled={majors.length === 0}
                >
                  <option value="">선택하세요</option>
                  {majors.map((major) => (
                    <option key={major.code} value={major.code}>
                      {major.name} {major.campus ? `(${major.campus})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="cta fill"
                type="button"
                onClick={loadCourses}
                disabled={!selectedMajor || loadingCourses}
              >
                {loadingCourses ? '강좌 불러오는 중…' : '강좌 조회'}
              </button>
              <div className="api-meta">
                연도 {apiYear} · {apiSession}학기 · {campus === 'H1' ? '서울' : '글로벌'}
              </div>
            </div>
            {apiError && <div className="api-error">{apiError}</div>}
          </div>
        </div>
      </section>

      <section className="panel tab-panel">
        <div className="panel-head">
          <div>
            <p className="subtle">분반 선택</p>
            <h2>검색 · 필터 · 분반</h2>
          </div>
          <button
            className="toggle-btn"
            type="button"
            onClick={() => setExploreCollapsed((prev) => !prev)}
          >
            {exploreCollapsed ? '펼치기' : '접기'}
          </button>
        </div>
        {!exploreCollapsed && (
          <div className="tab-content">
            <div className="filters">
              <div className="search">
                <label htmlFor="search">검색</label>
                <input
                  id="search"
                  type="search"
                  placeholder="과목명 / 교수명 / 학수번호"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="filter-group">
                <span className="filter-label">학년</span>
                <div className="filter-chips">
                  {['all', 2, 3, 4].map((value) => (
                    <button
                      key={value}
                      className={`chip ${gradeFilter === value ? 'active' : 'ghost'}`}
                      type="button"
                      onClick={() => setGradeFilter(value === 'all' ? 'all' : Number(value))}
                    >
                      {value === 'all' ? '전체' : `${value}학년`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <span className="filter-label">요일</span>
                <div className="filter-chips">
                  {(['all', ...dayOrder] as (Day | 'all')[]).map((value) => (
                    <button
                      key={value}
                      className={`chip ${dayFilter === value ? 'active' : 'ghost'}`}
                      type="button"
                      onClick={() => setDayFilter(value)}
                    >
                      {value === 'all' ? '전체' : value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel courses inner">
              <div className="panel-head">
                <div>
                  <p className="subtle">분반 목록</p>
                  <h2>과목 {filteredCourses.length}개</h2>
                </div>
                <p className="subtle">선택 후 아래 시간표를 확인하세요</p>
              </div>
              <div className="course-list">
                {filteredCourses.map((course) => {
                  const selected = selectedIds.includes(course.id)
                  const hasConflict = conflictWithSelection(course)
                  return (
                    <article
                      key={course.id}
                      className={`course-card ${selected ? 'selected' : ''} ${
                        hasConflict ? 'conflict' : ''
                      }`}
                    >
                      <div className="course-top">
                        <div className="course-title">
                          <span className="code">{course.code}</span>
                          <h3>{course.name}</h3>
                        </div>
                        <div className="pill-row">
                          <span className="pill outline">{course.grade}학년</span>
                          {course.english && <span className="pill">ENG</span>}
                        </div>
                      </div>
                      <p className="meta">
                        {course.professor} · {course.credit}학점 · {course.area}
                      </p>
                      <p className="time">{formatSlots(course)}</p>
                      <div className="card-actions">
                        {hasConflict && <span className="conflict-label">시간 충돌</span>}
                        <button className="cta" type="button" onClick={() => toggleCourse(course)}>
                          {selected ? '제거' : '추가'}
                        </button>
                      </div>
                    </article>
                  )
                })}
                {filteredCourses.length === 0 && (
                  <div className="empty-state">
                    <strong>조건에 맞는 과목이 없습니다.</strong>
                    <p className="subtle">검색어나 필터를 바꿔 보세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel timetable-panel">
        <div className="panel-head">
          <div>
            <p className="subtle">시간표</p>
            <h2>조합 미리보기</h2>
          </div>
          <div className="timetable-actions">
            <button className="chip ghost" type="button" onClick={() => setSaveModal(true)}>
              시간표 추가
            </button>
            <button className="chip" type="button" onClick={exportTimetable} disabled={exporting}>
              {exporting ? '이미지 생성 중…' : '시간표 이미지로 저장'}
            </button>
          </div>
        </div>
        <div className="timetable-and-saves">
          <div className="timetable-wrapper" ref={timetableRef}>
            <div className="panel-head subtle-head">
              <div className="stat-chips">
                <span className="stat-chip">선택 {selectedCourses.length}과목</span>
                <span className="stat-chip">총 {totalCredits}학점</span>
                <span className={`stat-chip ${timetable.conflicts.size ? 'danger' : ''}`}>
                  {timetable.conflicts.size ? `충돌 ${timetable.conflicts.size}` : '충돌 없음'}
                </span>
              </div>
              <span className="muted">
                한국외대 시간표 시물레이션{' '}
                <a className="inline-link" href="https://hufs.gdgoc.com" target="_blank" rel="noreferrer">
                  https://hufs.gdgoc.com
                </a>
              </span>
            </div>
            <div className="timetable-scroll">
              <div className="grid" ref={timetableGridRef}>
                <div className="cell head sticky"></div>
                {dayOrder.map((day) => (
                  <div key={day} className="cell head">
                    {day}
                  </div>
                ))}
                {periods.slice(0, maxPeriod).map((period) => (
                  <Fragment key={period.num}>
                    <div className="cell head sticky">
                      <div className="period-label">{period.num}교시</div>
                      <div className="period-time">{period.time}</div>
                    </div>
                    {dayOrder.map((day) => {
                      const bucket = timetable.grid[day][period.num] ?? []
                      const crowded = bucket.length > 1
                      return (
                        <div
                          key={`${day}-${period.num}`}
                          className={`cell slot ${crowded ? 'conflict' : ''}`}
                        >
                          {bucket.length === 0
                            ? null
                            : bucket.map((course) => (
                                <div
                                  key={`${course.id}-${period.num}-${day}`}
                                  className={`slot-pill ${
                                    timetable.conflicts.has(course.id) ? 'danger' : ''
                                  }`}
                                >
                                  <span className="slot-name">{course.name}</span>
                                  <span className="slot-code">{course.code}</span>
                                </div>
                              ))}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="saved-panel">
            <div className="list-head">
              <strong>저장된 시간표</strong>
              <span className="muted">{savedPlans.length}개</span>
            </div>
            <ul className="saved-list">
              {savedPlans.map((plan) => (
                <li key={plan.id} className="saved-item">
                  <div>
                    <div className="saved-name">{plan.name}</div>
                    <div className="muted">{new Date(plan.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="saved-actions">
                    <button className="chip ghost" type="button" onClick={() => loadPlan(plan)}>
                      불러오기
                    </button>
                    <button className="chip ghost danger" type="button" onClick={() => deletePlan(plan)}>
                      삭제
                    </button>
                  </div>
                </li>
              ))}
              {savedPlans.length === 0 && <li className="muted">아직 저장된 시간표가 없습니다.</li>}
            </ul>
          </div>
        </div>
      </section>

      {saveModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>시간표 이름을 지어주세요</h3>
            <input
              className="plan-name-input"
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              placeholder="예: 2026 1학기 전공 위주"
              autoFocus
            />
            <div className="modal-actions">
              <button className="chip ghost" type="button" onClick={() => setSaveModal(false)}>
                취소
              </button>
              <button className="chip" type="button" onClick={saveCurrentPlan}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="banner footer-banner">
        <div className="banner-top">
          <div>
            <p className="muted">만든이</p>
            <strong>컴퓨터공학부 23학번 강대현</strong>
          </div>
        </div>
        <div className="banner-links">
          <a href="https://github.com/daehyuh" target="_blank" rel="noreferrer">
            Github · daehyuh
          </a>
          <a href="https://www.instagram.com/daehyuh_/" target="_blank" rel="noreferrer">
            Instagram · @daehyuh_
          </a>
        </div>
        <div className="banner-bottom">
          <div>
            <p className="muted">코딩에 관심많은 외대생들 모여라</p>
            <strong>한국외대 프로그래밍 소통방</strong>
          </div>
          <a className="kakao-link" href="https://open.kakao.com/o/gVAIxGsf" target="_blank" rel="noreferrer">
            카카오톡 오픈채팅 참여하기
          </a>
        </div>
      </section>

    </div>
  )
}

export default App
